"""
八股文速记 - Flask 后端
运行: pip install flask flask-cors && python app.py
"""
import json, os, sqlite3, hashlib, hmac, base64, time
import urllib.request
from flask import Flask, request, jsonify, Response, g
from flask_cors import CORS

# Load .env
_env = os.path.join(os.path.dirname(__file__), ".env")
if os.path.exists(_env):
    for line in open(_env, encoding="utf-8"):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

app = Flask(__name__, static_folder="static", static_url_path="")
CORS(app)

DB_PATH = os.path.join(os.path.dirname(__file__), "flashcards.db")
JWT_SECRET = os.environ.get("JWT_SECRET", "changeme_please")

# ── Simple JWT (no external deps) ──
def _b64(data):
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

def _unb64(s):
    s += "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s)

def jwt_encode(payload):
    header = _b64(json.dumps({"alg":"HS256","typ":"JWT"}).encode())
    body   = _b64(json.dumps(payload).encode())
    sig    = _b64(hmac.new(JWT_SECRET.encode(), f"{header}.{body}".encode(), hashlib.sha256).digest())
    return f"{header}.{body}.{sig}"

def jwt_decode(token):
    try:
        header, body, sig = token.split(".")
        expected = _b64(hmac.new(JWT_SECRET.encode(), f"{header}.{body}".encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(sig, expected):
            return None
        payload = json.loads(_unb64(body))
        if payload.get("exp", 0) < time.time():
            return None
        return payload
    except Exception:
        return None

def hash_pw(pw):
    return hashlib.sha256(pw.encode()).hexdigest()

def require_auth(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get("Authorization", "").replace("Bearer ", "", 1).strip()
        payload = jwt_decode(token) if token else None
        if not payload:
            return jsonify({"error": "未登录"}), 401
        g.username = payload.get("sub", "")
        return f(*args, **kwargs)
    return decorated

def get_username():
    token = request.headers.get("Authorization", "").replace("Bearer ", "", 1).strip()
    payload = jwt_decode(token) if token else None
    return payload.get("sub", "") if payload else None

# ── Database Setup ──
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn

def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS decks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS cards (
            id TEXT PRIMARY KEY,
            deck_id INTEGER NOT NULL,
            category TEXT NOT NULL DEFAULT '',
            question TEXT NOT NULL,
            answer TEXT NOT NULL,
            tips TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS scores (
            username TEXT NOT NULL,
            card_id TEXT NOT NULL,
            result TEXT NOT NULL CHECK(result IN ('ok','fail')),
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (username, card_id)
        );
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL
        );
    """)
    conn.commit()
    # Seed default data if empty
    if conn.execute("SELECT COUNT(*) FROM decks").fetchone()[0] == 0:
        seed_default_data(conn)
    seed_users(conn)
    conn.commit()
    conn.close()

def seed_default_data(conn):
    """Insert all built-in cards"""
    conn.execute("INSERT INTO decks (id, name) VALUES (1, 'Python基础')")
    conn.execute("INSERT INTO decks (id, name) VALUES (2, '计算机网络')")
    conn.execute("INSERT INTO decks (id, name) VALUES (3, '操作系统')")
    conn.execute("INSERT INTO decks (id, name) VALUES (4, '数据库SQL')")
    conn.execute("INSERT INTO decks (id, name) VALUES (5, '测试理论')")
    conn.execute("INSERT INTO decks (id, name) VALUES (6, 'Linux基础')")

    cards = []
    # ── Python 基础 (30题) ──
    py = [
        ("p1","基础类型","说说Python有哪些数据类型？哪些可变哪些不可变？","6种基本类型：Number、String、List、Tuple、Set、Dict\n另有 bool 和 None\n\n不可变（改值=新对象）：Number、String、Tuple\n可变（原地修改）：List、Dict、Set\n\n为什么区分？\n• 不可变才能做dict的key\n• 函数传参可变类型传引用，可能被意外修改","tuple里放list不能做dict key→内部有可变元素不可哈希"),
        ("p2","基础类型","列表和元组有什么区别？","List：可变 []，支持增删改\nTuple：不可变 ()，性能好，可做dict key\n\n```python\nt = (1,)   # 元组（注意逗号）\nt = (1)    # 只是int\n```\n\n「不可变」= 引用不可变\n```python\nt = ([1,2], 3)\nt[0].append(3)  # 合法！\nt[0] = [4,5]    # 报错！\n```","需要修改→list，固定数据→tuple"),
        ("p3","基础类型","list和dict底层怎么实现的？","List → 动态数组\n• 连续内存，索引O(1)，append均摊O(1)\n\nDict → 哈希表\n• 对key算hash映射索引\n• 冲突：开放寻址法\n• 查找/插入/删除均摊O(1)\n• Python3.7+保持插入顺序\n\n```python\nd = {[1,2]: 'x'}  # TypeError!\n```","dict查找O(1)比list遍历O(n)快"),
        ("p4","基础类型","列表推导式和生成器表达式区别？","```python\n[x**2 for x in range(10) if x%2==0]  # list\n(x**2 for x in range(10) if x%2==0)  # generator\n```\n\n推导式：占内存，可重复遍历\n生成器：省内存，只能遍历一次","数据量小→推导式，大→生成器"),
        ("p5","核心概念","深拷贝和浅拷贝区别？","```python\nimport copy\na = [[1,2], [3,4]]\nb = copy.copy(a)      # 浅拷贝\nb[0].append(5)\nprint(a[0])  # [1,2,5] ←被影响！\n\nc = copy.deepcopy(a)  # 深拷贝\nc[0].append(6)\nprint(a[0])  # [1,2,5] ←不受影响\n```\n\n浅拷贝：新外层，嵌套共享引用\n深拷贝：递归拷贝所有层级","a[:]、list(a)、dict.copy()都是浅拷贝"),
        ("p6","核心概念","is和==区别？","== 比较值，is 比较内存地址\n\n```python\na=[1,2]; b=[1,2]\na==b  # True  a is b  # False\na=256; b=256; a is b  # True(缓存)\n```\n\n判断None用is：if x is None","小整数池-5~256"),
        ("p7","核心概念","LEGB作用域规则？","L Local → E Enclosing → G Global → B Built-in\n\n```python\ndef outer():\n    y = 10\n    def inner():\n        nonlocal y\n        y = 20\n```\n\nglobal修改全局，nonlocal修改外层","坑：函数内先读后赋值同名变量→UnboundLocalError"),
        ("p8","核心概念","垃圾回收机制讲讲？","1. 引用计数（主要）：计数为0→立即回收\n   缺点：循环引用无法处理\n\n2. 标记-清除：解决循环引用\n\n3. 分代回收：0/1/2三代\n   新对象第0代，扫描频率高","sys.getrefcount()查看引用计数"),
        ("p9","核心概念","Python是解释型还是编译型？","解释型语言\n编译型(C/C++)：一次编译，快但跨平台差\n解释型(Python)：边解释边执行，慢但跨平台好\n\nPython：.py→.pyc(字节码)→PVM解释执行","提高效率：C扩展/Cython/多进程/numpy"),
        ("p10","函数","*args和**kwargs怎么用？","```python\ndef f(a, b, *args, **kwargs):\n    print(args)    # (3,4) tuple\n    print(kwargs)  # {'x':5} dict\nf(1, 2, 3, 4, x=5)\n```\n\n顺序：普通→*args→**kwargs\n解包：f(*list) f(**dict)","*和**是语法关键，名字只是约定"),
        ("p11","函数","装饰器是什么？手写一个","```python\nimport functools\ndef log(func):\n    @functools.wraps(func)\n    def wrapper(*args, **kwargs):\n        print(f'调用{func.__name__}')\n        return func(*args, **kwargs)\n    return wrapper\n\n@log\ndef say(): print('hi')\n```\n\n本质：接收函数→返回函数","@functools.wraps保留原函数信息"),
        ("p12","函数","闭包是什么？","闭包=内部函数+捕获的外部变量\n\n```python\ndef outer(x):\n    def inner(y): return x + y\n    return inner\nadd5 = outer(5)\nadd5(3)  # 8\n```","修改外部变量需nonlocal"),
        ("p13","函数","闭包陷阱：这段代码输出什么？","```python\nfuncs = [lambda x: x*i for i in range(4)]\nprint([f(2) for f in funcs])\n# [6,6,6,6] 不是[0,2,4,6]！\n```\n\n修复：\n```python\nfuncs = [lambda x,i=i: x*i for i in range(4)]\n```","闭包延迟绑定，面试出现率极高"),
        ("p14","函数","可变默认参数有什么坑？","```python\ndef add(item, lst=[]):\n    lst.append(item)\n    return lst\nadd(1)  # [1]\nadd(2)  # [1,2] ←不是[2]！\n```\n\n正确：\n```python\ndef add(item, lst=None):\n    if lst is None: lst = []\n```","默认值存在func.__defaults__"),
        ("p15","函数","lambda和filter/map/reduce？","```python\nlist(filter(lambda x: x%2==1, range(10)))\nlist(map(lambda x: x**2, [1,2,3]))\nfrom functools import reduce\nreduce(lambda x,y: x+y, range(101))  # 5050\n```","列表推导式更Pythonic"),
        ("p16","面向对象","面向对象三大特性？","封装：_x约定私有，__x名称改写\n继承：class Admin(User): pass\n多态：鸭子类型→不看类型看行为\n\n多重继承用C3算法(MRO)","鸭子类型：走路像鸭子就是鸭子"),
        ("p17","面向对象","__new__和__init__区别？","```python\nclass Foo:\n    def __new__(cls):\n        print('创建')  # 先\n        return super().__new__(cls)\n    def __init__(self):\n        print('初始化')  # 后\n```\n\n__new__创建实例返回对象，__init__初始化","单例模式用__new__实现"),
        ("p18","面向对象","__str__和__repr__区别？","```python\nclass P:\n    def __str__(self):  return '(1,2)'\n    def __repr__(self): return 'P(1,2)'\n```\n__str__给用户看，__repr__给开发者看\n没有__str__会用__repr__","__repr__目标：无歧义"),
        ("p19","并发编程","多线程、多进程、协程怎么选？","多线程：共享内存，受GIL→I/O密集\n多进程：内存独立，不受GIL→CPU密集\n协程asyncio：单线程切换→高并发I/O\n\n```python\nasync def fetch():\n    await asyncio.sleep(1)\n```","进程通信Queue/Pipe，线程同步Lock"),
        ("p20","并发编程","GIL是什么？怎么绕过？","全局解释器锁：同一时刻只有一个线程执行字节码\n原因：CPython引用计数非线程安全\n\n绕过：多进程/C扩展/asyncio/Jython","Python3.13支持--disable-gil"),
        ("p21","高频实战","迭代器和生成器区别？","```python\nit = iter([1,2,3])\nnext(it)  # 1\n\ndef gen():\n    yield 1; yield 2\nfor v in gen(): print(v)\n```\n\n生成器是特殊迭代器","yield暂停产出值，send()传值"),
        ("p22","高频实战","with语句怎么工作的？","```python\nwith open('f.txt') as f:\n    data = f.read()\n```\n\n原理：__enter__进入 __exit__退出\n简洁写法：@contextmanager + yield","常见：open() Lock() 数据库连接"),
        ("p23","高频实战","try/except/else/finally？","```python\ntry:\n    result = 10 / x\nexcept ZeroDivisionError as e:\n    print(f'出错:{e}')\nelse:\n    print('成功')    # 无异常才执行\nfinally:\n    print('清理')    # 无论如何执行\n```","else让try块尽量小"),
        ("p24","高频实战","+和join区别？格式化？","```python\ns = ''.join(words)  # O(n)\nf'{name} is {age}'  # f-string最推荐\n```\n少量用+，循环必须用join","f-string性能最好可读性最强"),
        ("p25","高频实战","单例模式怎么实现？","```python\nclass Singleton:\n    _instance = None\n    def __new__(cls):\n        if cls._instance is None:\n            cls._instance = super().__new__(cls)\n        return cls._instance\n```\n\n线程安全→双重检查锁+Lock","双重检查：外层if避免每次加锁"),
        ("p26","核心概念","单下划线和双下划线区别？","```python\nself._x = 1     # 约定私有\nself.__y = 2    # 名称改写→_C__y\nself.__z__ = 3  # 魔法属性\n```","staticmethod无self，classmethod参数cls"),
        ("p27","核心概念","反射getattr怎么用？","```python\nclass Dog:\n    def bark(self): return 'woof'\nd = Dog()\nhasattr(d,'bark')    # True\ngetattr(d,'bark')()  # 'woof'\nsetattr(d,'name','Max')\n```","自省：type() dir() isinstance()"),
        ("p28","高频实战","列表去重？保持顺序？","```python\nlst = [3,1,2,3,1,4]\nlist(set(lst))           # 不保序\nlist(dict.fromkeys(lst)) # [3,1,2,4] 保序\n```","dict.fromkeys保序需Python3.7+"),
        ("p29","核心概念","os和sys模块区别？","```python\nos.getcwd(); os.listdir('.')\nos.path.join('a','b')\nsys.argv; sys.path; sys.version\n```\nos管操作系统，sys管解释器","Python3.4+推荐pathlib"),
        ("p30","高频实战","怎么提高Python运行效率？","1. 生成器代替列表\n2. numpy向量化\n3. C扩展/Cython/Numba\n4. 多进程利用多核\n5. 合适数据结构\n\n```python\nnp.sum(arr**2)  # 比for循环快100倍\n```","CPU密集→多进程，I/O密集→协程"),
    ]
    for c in py:
        cards.append((c[0], 1, c[1], c[2], c[3], c[4]))

    # ── 计算机网络 (10题) ──
    net = [
        ("n1","传输层","TCP和UDP有什么区别？","TCP：面向连接，可靠传输，有序，有流量控制和拥塞控制\nUDP：无连接，不可靠，无序，速度快\n\n```\nTCP → 文件传输/网页/邮件（需要可靠）\nUDP → 视频直播/DNS/游戏（需要速度）\n```\n\nTCP像打电话（先拨号建立连接）\nUDP像发短信（直接发，不管对方收没收到）","追问：TCP怎么保证可靠？→ 确认应答+超时重传+滑动窗口"),
        ("n2","传输层","TCP三次握手过程？为什么不能两次？","```\n客户端 → SYN=1, seq=x          → 服务端\n客户端 ← SYN=1, ACK=1, seq=y, ack=x+1 ← 服务端\n客户端 → ACK=1, seq=x+1, ack=y+1 → 服务端\n```\n\n为什么不能两次？\n防止已失效的连接请求到达服务端\n如果只有两次，服务端收到旧的SYN会白白建连接浪费资源","三次握手本质：双方确认彼此的收发能力"),
        ("n3","传输层","TCP四次挥手？为什么要等2MSL？","```\n客户端 → FIN → 服务端（我说完了）\n客户端 ← ACK ← 服务端（收到）\n客户端 ← FIN ← 服务端（我也说完了）\n客户端 → ACK → 服务端（收到，等2MSL后关闭）\n```\n\n为什么四次不能三次？\n服务端收到FIN时可能还有数据没发完\n\n为什么等2MSL？\n确保最后一个ACK能到达服务端\n让本次连接的所有报文在网络中消失","MSL=报文最大生存时间，通常30秒-2分钟"),
        ("n4","应用层","从输入URL到页面显示，经历了什么？","1. DNS解析：域名→IP地址\n   浏览器缓存→系统缓存→路由器→DNS服务器\n\n2. TCP连接：三次握手建立连接\n\n3. 发送HTTP请求\n\n4. 服务器处理请求，返回HTTP响应\n\n5. 浏览器解析渲染：\n   HTML→DOM树\n   CSS→CSSOM树\n   DOM+CSSOM→渲染树→布局→绘制\n\n6. TCP四次挥手断开连接","这道题考的是对整个网络协议栈的理解"),
        ("n5","应用层","HTTP和HTTPS区别？","HTTP：明文传输，端口80\nHTTPS：HTTP+SSL/TLS加密，端口443\n\nHTTPS握手过程：\n1. 客户端发起请求\n2. 服务端返回证书（含公钥）\n3. 客户端验证证书，生成随机密钥\n4. 用公钥加密随机密钥发给服务端\n5. 双方用随机密钥对称加密通信\n\n→ 非对称加密交换密钥，对称加密传输数据","追问：为什么不全用非对称加密？→ 太慢了"),
        ("n6","应用层","HTTP常见状态码？","```\n2xx 成功：200 OK / 201 Created / 204 No Content\n3xx 重定向：301 永久 / 302 临时 / 304 未修改(缓存)\n4xx 客户端错误：400 Bad Request / 401 未授权\n                403 Forbidden / 404 Not Found\n5xx 服务端错误：500 Internal Error\n                502 Bad Gateway / 503 Service Unavailable\n```","301和302区别：301搜索引擎会更新URL，302不会"),
        ("n7","应用层","GET和POST区别？","GET：参数在URL里，有长度限制，可缓存，幂等\nPOST：参数在body里，无长度限制，不可缓存，非幂等\n\n本质区别：语义不同\nGET→获取资源\nPOST→提交数据\n\n技术上GET也能有body，POST也能在URL带参数\n但规范建议按语义使用","追问：幂等是什么？→ 多次请求结果一样"),
        ("n8","应用层","Cookie和Session区别？","Cookie：存在客户端浏览器，每次请求自动携带\nSession：存在服务端，通过cookie中的session_id关联\n\n```\n客户端              服务端\n  │──请求──→        创建session\n  │←─Set-Cookie: sid=abc─│\n  │──Cookie: sid=abc──→  查找session\n```\n\nCookie不安全（可篡改），Session更安全\nSession增加服务端压力","Token/JWT是现在更流行的方案"),
        ("n9","网络层","TCP/IP四层模型分别是什么？","```\n应用层：HTTP/FTP/DNS/SMTP\n传输层：TCP/UDP\n网络层：IP/ICMP/ARP\n网络接口层：以太网/WiFi\n```\n\n对比OSI七层：应用层=应用+表示+会话\n\n数据封装过程：\n数据→加TCP头(段)→加IP头(包)→加MAC头(帧)→比特流","面试一般问四层模型就够了"),
        ("n10","应用层","HTTP 1.0/1.1/2.0/3.0区别？","1.0：每次请求新建TCP连接（短连接）\n1.1：默认长连接(keep-alive)，管道化\n2.0：多路复用（一个连接并发多个请求）\n     头部压缩，服务端推送，二进制帧\n3.0：基于UDP的QUIC协议\n     更快的连接建立，更好的拥塞控制","追问：什么是队头阻塞？→ 1.1的问题，2.0解决了HTTP层面的，3.0解决了TCP层面的"),
    ]
    for c in net:
        cards.append((c[0], 2, c[1], c[2], c[3], c[4]))

    # ── 操作系统 (10题) ──
    os_cards = [
        ("o1","进程与线程","进程和线程有什么区别？","进程：资源分配的最小单位，有独立地址空间\n线程：CPU调度的最小单位，共享进程资源\n\n区别：\n• 进程间内存独立，线程间共享内存\n• 进程创建开销大，线程小\n• 进程间通信复杂(IPC)，线程直接读写共享变量\n• 一个进程崩了不影响其他，一个线程崩了整个进程挂\n\n类比：\n进程=工厂（独立资源）\n线程=工厂里的工人（共享资源）","追问：协程是什么？→ 用户态线程，比线程更轻量"),
        ("o2","进程与线程","进程间通信(IPC)有哪些方式？","1. 管道(Pipe)：半双工，父子进程间\n2. 命名管道(FIFO)：无亲缘关系也可用\n3. 消息队列：内核中的消息链表\n4. 共享内存：最快的IPC方式\n5. 信号量(Semaphore)：用于同步\n6. Socket：可跨网络通信\n7. 信号(Signal)：如kill命令\n\n```\n速度：共享内存 > 管道 > 消息队列 > Socket\n```","共享内存最快但需要自己处理同步问题"),
        ("o3","进程与线程","什么是死锁？产生条件？怎么避免？","死锁：多个进程互相等待对方持有的资源，都无法继续执行\n\n四个必要条件（缺一不可）：\n1. 互斥：资源一次只能一个进程使用\n2. 持有并等待：持有资源的同时等待其他资源\n3. 不可剥夺：已分配资源不能被强制回收\n4. 循环等待：形成环形等待链\n\n避免方法：\n• 破坏循环等待：按固定顺序申请资源\n• 破坏持有并等待：一次性申请所有资源\n• 超时放弃：获取锁时设置超时\n• 银行家算法：预判安全状态","面试必考！记住四个条件+至少两种避免方法"),
        ("o4","进程与线程","进程有哪些状态？状态转换？","五种状态：\n```\n新建 → 就绪 ⇄ 运行 → 终止\n              ↓    ↑\n              阻塞 →┘\n```\n\n就绪→运行：被CPU调度选中\n运行→就绪：时间片用完\n运行→阻塞：等待I/O\n阻塞→就绪：I/O完成","僵尸进程：子进程退出但父进程没回收；孤儿进程：父进程先退出"),
        ("o5","进程调度","常见的进程调度算法？","1. FCFS(先来先服务)：简单但对短作业不友好\n2. SJF(短作业优先)：平均等待最短但可能饥饿\n3. 时间片轮转：每个进程轮流执行固定时间\n4. 优先级调度：按优先级高低调度\n5. 多级反馈队列：结合以上优点\n\n多级反馈队列：\n高优先级队列时间片短，低优先级时间片长\n新进程进入最高优先级队列","Linux用CFS(完全公平调度器)"),
        ("o6","内存管理","虚拟内存是什么？有什么用？","虚拟内存：让程序以为自己拥有连续的完整内存空间\n实际上：物理内存+磁盘交换空间\n\n好处：\n• 每个进程有独立地址空间（安全隔离）\n• 可以运行比物理内存更大的程序\n• 共享内存、内存映射文件\n\n实现：分页机制\n虚拟地址 → 页表 → 物理地址\n缺页中断：访问的页不在物理内存→从磁盘加载","追问：页面置换算法？→ LRU(最近最少使用)/FIFO/LFU"),
        ("o7","内存管理","什么是缓冲区溢出？","程序向缓冲区写入的数据超过了缓冲区的大小\n覆盖了相邻内存区域\n\n危害：\n• 程序崩溃\n• 攻击者可以覆盖返回地址执行恶意代码\n\n防御：\n• 边界检查\n• 使用安全函数(strncpy替代strcpy)\n• 栈保护(canary)\n• 地址随机化(ASLR)\n• 数据执行保护(DEP)","测试开发需要了解安全基础"),
        ("o8","同步与互斥","什么是互斥锁？什么是信号量？","互斥锁(Mutex)：一次只允许一个线程进入临界区\n```python\nlock = threading.Lock()\nwith lock:\n    # 临界区代码\n```\n\n信号量(Semaphore)：允许N个线程同时进入\n```python\nsem = threading.Semaphore(3)  # 最多3个并发\nwith sem:\n    # 最多3个线程同时执行\n```\n\n互斥锁=信号量(1)的特例","追问：什么是可重入锁？→ RLock，同一线程可多次获取"),
        ("o9","进程与线程","用户态和内核态区别？","用户态：运行用户程序，权限受限\n内核态：运行OS内核，可访问所有资源\n\n切换场景：\n• 系统调用（如read/write/fork）\n• 异常（如缺页中断）\n• 外部中断（如I/O完成）\n\n代价：切换需要保存/恢复上下文，开销大\n\n所以要减少系统调用次数\n如：用缓冲I/O代替直接I/O","协程的优势：不需要内核态切换"),
        ("o10","综合","线程安全是什么？怎么实现？","线程安全：多线程并发访问共享资源时结果仍然正确\n\n不安全的例子：\n```python\n# 两个线程同时执行 count += 1\n# 可能丢失更新\n```\n\n实现方式：\n1. 互斥锁 Lock/RLock\n2. 条件变量 Condition\n3. 原子操作\n4. 线程本地存储 threading.local()\n5. 不可变对象（天然线程安全）\n6. 队列 queue.Queue（线程安全）","GIL不能保证Python代码线程安全！只保证解释器级别安全"),
    ]
    for c in os_cards:
        cards.append((c[0], 3, c[1], c[2], c[3], c[4]))

    # ── 数据库SQL (10题) ──
    db = [
        ("d1","索引","MySQL索引原理？为什么用B+树？","B+树特点：\n• 非叶子节点只存索引，不存数据\n• 叶子节点通过链表连接，支持范围查询\n• 树矮胖，一般3-4层就能存千万级数据\n\n对比：\n• B树：非叶子也存数据，范围查询差\n• 哈希索引：等值查询O(1)但不支持范围\n• 红黑树：太高了，磁盘IO多\n\n```sql\nCREATE INDEX idx_name ON users(name);\n```","追问：什么是回表？→ 非聚簇索引先查到主键，再通过主键查数据"),
        ("d2","事务","什么是事务？ACID是什么？","事务：一组操作要么全部成功，要么全部失败\n\nACID：\nA - 原子性：不可分割，要么全做要么全不做\nC - 一致性：事务前后数据库状态一致\nI - 隔离性：并发事务之间互不干扰\nD - 持久性：提交后数据永久保存\n\n```sql\nBEGIN;\nUPDATE accounts SET balance = balance - 100 WHERE id = 1;\nUPDATE accounts SET balance = balance + 100 WHERE id = 2;\nCOMMIT;\n```","面试官最爱追问隔离性→隔离级别"),
        ("d3","事务","事务隔离级别有哪些？","```\n               脏读  不可重复读  幻读\n读未提交        ✓      ✓        ✓\n读已提交        ✗      ✓        ✓   (Oracle默认)\n可重复读        ✗      ✗        ✓   (MySQL默认)\n串行化          ✗      ✗        ✗\n```\n\n脏读：读到未提交的数据\n不可重复读：两次读同一行结果不同\n幻读：两次查询行数不同","MySQL的可重复读通过MVCC+间隙锁基本解决了幻读"),
        ("d4","查询","内连接、左连接、右连接区别？","```sql\n-- 内连接：只返回两表都匹配的行\nSELECT * FROM A INNER JOIN B ON A.id = B.aid;\n\n-- 左连接：返回左表所有行+右表匹配行\nSELECT * FROM A LEFT JOIN B ON A.id = B.aid;\n-- 右表没匹配的显示NULL\n\n-- 右连接：返回右表所有行+左表匹配行\nSELECT * FROM A RIGHT JOIN B ON A.id = B.aid;\n```\n\n实际开发中LEFT JOIN用得最多","追问：FULL JOIN？→ MySQL不支持，用UNION模拟"),
        ("d5","优化","如何优化慢SQL？","1. EXPLAIN看执行计划\n   关注：type(ALL=全表扫描)、rows、Extra\n\n2. 加合适的索引\n   WHERE条件列、JOIN列、ORDER BY列\n\n3. 避免索引失效：\n   • 对列使用函数/运算\n   • LIKE '%开头'\n   • OR条件\n   • 隐式类型转换\n\n4. 减少SELECT *，只查需要的列\n5. 分页优化：大偏移量用游标\n6. 合理使用覆盖索引\n\n```sql\nEXPLAIN SELECT * FROM users WHERE name = 'x';\n```","type从好到差：const>eq_ref>ref>range>index>ALL"),
        ("d6","索引","聚簇索引和非聚簇索引区别？","聚簇索引（主键索引）：\n• 叶子节点存储完整行数据\n• 一张表只能有一个\n• 数据按主键顺序物理存储\n\n非聚簇索引（二级索引）：\n• 叶子节点存储主键值\n• 一张表可以有多个\n• 查询需要回表（先查主键，再查数据）\n\n覆盖索引：索引包含了查询需要的所有列，不用回表","InnoDB的主键建议用自增整数，避免页分裂"),
        ("d7","查询","GROUP BY / HAVING / ORDER BY 执行顺序？","SQL执行顺序（不是书写顺序）：\n```\n1. FROM + JOIN\n2. WHERE        ← 过滤行\n3. GROUP BY     ← 分组\n4. HAVING       ← 过滤组\n5. SELECT       ← 选择列\n6. DISTINCT     ← 去重\n7. ORDER BY     ← 排序\n8. LIMIT        ← 限制行数\n```\n\nWHERE在分组前过滤，HAVING在分组后过滤\nWHERE不能用聚合函数，HAVING可以","记住这个顺序能避免很多SQL错误"),
        ("d8","查询","子查询和JOIN哪个性能好？","一般来说JOIN更好，因为：\n• 子查询可能为每行执行一次（相关子查询）\n• JOIN可以利用索引\n\n```sql\n-- 子查询（可能慢）\nSELECT * FROM orders\nWHERE uid IN (SELECT id FROM users WHERE age > 20);\n\n-- 改写为JOIN（通常快）\nSELECT o.* FROM orders o\nJOIN users u ON o.uid = u.id\nWHERE u.age > 20;\n```\n\n但MySQL优化器有时会自动改写","EXISTS vs IN：外表小用IN，外表大用EXISTS"),
        ("d9","锁","MySQL有哪些锁？","按粒度：\n• 表锁：锁整张表，开销小，并发低\n• 行锁：锁一行，开销大，并发高(InnoDB)\n• 间隙锁：锁住一个范围，防止幻读\n\n按类型：\n• 共享锁(S锁/读锁)：多人可同时读\n• 排他锁(X锁/写锁)：只有一人能写\n\n```sql\nSELECT ... LOCK IN SHARE MODE;  -- 共享锁\nSELECT ... FOR UPDATE;          -- 排他锁\n```","InnoDB默认行锁，MyISAM只支持表锁"),
        ("d10","设计","数据库三大范式？","第一范式(1NF)：列不可再分（原子性）\n第二范式(2NF)：非主属性完全依赖主键\n第三范式(3NF)：非主属性不传递依赖主键\n\n通俗理解：\n1NF：每个单元格只有一个值\n2NF：每列都和主键有关，不是只和部分主键有关\n3NF：每列直接依赖主键，不能间接依赖\n\n实际开发中适当反范式化（冗余）换性能","面试一般问到第三范式就够了"),
    ]
    for c in db:
        cards.append((c[0], 4, c[1], c[2], c[3], c[4]))

    # ── 测试理论 (10题) ──
    test = [
        ("t1","测试方法","测试用例设计方法有哪些？","1. 等价类划分：把输入分成有效/无效等价类\n   如年龄(1-150)：有效(25)、无效(-1/200)\n\n2. 边界值分析：测试边界\n   如1-100：测试0,1,2,99,100,101\n\n3. 因果图/判定表：多条件组合\n\n4. 正交表：减少组合数\n\n5. 场景法：按业务流程测试\n\n6. 错误推测法：根据经验猜测易出错的地方","等价类+边界值最常用，面试必答"),
        ("t2","测试方法","黑盒和白盒测试区别？","黑盒测试：\n• 不关心内部代码，只看输入输出\n• 测试功能是否符合需求\n• 方法：等价类、边界值、场景法\n\n白盒测试：\n• 需要了解内部代码逻辑\n• 测试代码路径是否覆盖\n• 方法：语句覆盖、分支覆盖、路径覆盖\n\n灰盒测试：\n• 介于两者之间\n• 了解部分内部结构\n• 常见于接口测试","覆盖率从低到高：语句<分支<条件<路径"),
        ("t3","测试流程","软件测试的完整流程？","1. 需求分析：评审需求文档，提出疑问\n2. 制定测试计划：人员、时间、策略\n3. 设计测试用例：根据需求设计\n4. 评审测试用例：和开发/产品评审\n5. 搭建测试环境\n6. 执行测试：冒烟→功能→回归\n7. 提交Bug，跟踪修复\n8. 回归测试：验证Bug修复\n9. 编写测试报告\n10. 上线后监控\n\n测试人员应该从需求阶段就介入","测试左移：越早介入，修复成本越低"),
        ("t4","测试类型","冒烟测试和回归测试？","冒烟测试：\n• 在详细测试前的快速验证\n• 确认核心功能是否正常\n• 不通过则打回开发，不浪费时间\n\n回归测试：\n• 修复Bug后重新测试\n• 确认修复没有引入新问题\n• 确认其他功能没有被影响\n\n类比：\n冒烟测试=体检（快速判断健不健康）\n回归测试=复查（治疗后确认痊愈且没副作用）","冒烟测试的名字来源于硬件：通电后看会不会冒烟"),
        ("t5","用例设计","给你一个登录页面，怎么设计测试用例？","功能测试：\n• 正确账号密码登录成功\n• 错误密码/账号提示\n• 空账号/空密码提示\n• 特殊字符/超长输入\n• 验证码功能\n• 记住密码/自动登录\n\n安全性：\n• SQL注入：输入 ' OR 1=1 --\n• 密码是否加密传输\n• 多次错误是否锁定\n• 登录后session有效期\n\n兼容性/性能/UI：\n• 不同浏览器/设备\n• 并发登录\n• 页面布局/文案","这是最高频的场景题，一定要答全面"),
        ("t6","接口测试","接口测试怎么做？","1. 获取接口文档（Swagger/API文档）\n2. 设计测试用例：\n   • 正常参数返回正确结果\n   • 缺少必填参数\n   • 参数类型错误\n   • 边界值\n   • 权限验证\n\n3. 工具：Postman手动 / Pytest+Requests自动化\n\n```python\nimport requests\nresp = requests.get('http://api/users/1')\nassert resp.status_code == 200\nassert resp.json()['name'] == 'Alice'\n```\n\n4. 关注：状态码、返回数据、响应时间、幂等性","接口测试=最重要的测试类型之一"),
        ("t7","性能测试","性能测试关注哪些指标？","核心指标：\n• QPS/TPS：每秒查询/事务数\n• 响应时间：平均/P95/P99\n• 并发数：同时在线用户数\n• 吞吐量：单位时间处理的数据量\n• 错误率：失败请求的比例\n\n工具：JMeter / Locust / wrk\n\n测试类型：\n• 负载测试：逐步增加压力找极限\n• 压力测试：超过极限看系统表现\n• 稳定性测试：长时间运行看是否稳定","P99响应时间=99%请求都在这个时间内完成"),
        ("t8","Bug管理","Bug的生命周期？Bug报告包含什么？","生命周期：\n新建→指派→修复→验证→关闭\n         ↓          ↓\n       不是Bug    验证不通过→重新打开\n\nBug报告：\n• 标题：简明描述\n• 严重程度：致命/严重/一般/轻微\n• 优先级：高/中/低\n• 复现步骤：1. 2. 3.\n• 预期结果 vs 实际结果\n• 测试环境\n• 截图/日志","好的Bug报告=开发能直接复现"),
        ("t9","自动化","自动化测试框架怎么选？","Web UI自动化：\n• Selenium：最成熟，多语言支持\n• Playwright：微软出品，更快更稳\n• Cypress：前端友好，JS生态\n\n接口自动化：\n• Pytest + Requests（Python）\n• RestAssured（Java）\n\n移动端：\n• Appium\n\n框架设计模式：\n• Page Object Model（POM）\n• 数据驱动\n• 关键字驱动","Playwright是目前的趋势，建议学这个"),
        ("t10","综合","开发不认为是Bug怎么办？","1. 先确认是否真的是Bug：\n   • 对照需求文档\n   • 和产品确认预期行为\n\n2. 如果确认是Bug：\n   • 提供详细的复现步骤和证据\n   • 引用需求文档条款\n   • 从用户角度说明影响\n   • 如果无法达成一致，升级给测试经理和产品经理\n\n3. 态度：\n   • 对事不对人\n   • 用数据和文档说话\n   • 维护好和开发的关系","这是考沟通能力的题，态度比技术更重要"),
    ]
    for c in test:
        cards.append((c[0], 5, c[1], c[2], c[3], c[4]))

    # ── Linux基础 (10题) ──
    linux = [
        ("l1","文件操作","常用的Linux命令有哪些？","文件：ls/cd/pwd/mkdir/rm/cp/mv/cat/touch\n查看：head/tail/less/more/wc\n搜索：grep/find/locate\n权限：chmod/chown\n进程：ps/top/kill/nohup\n网络：ping/curl/wget/netstat/ss\n压缩：tar/zip/unzip\n\n```bash\n# 查看文件末尾并实时刷新\ntail -f app.log\n\n# 搜索包含error的行\ngrep -i 'error' app.log\n\n# 查找大于100M的文件\nfind / -size +100M\n```","面试最常问grep/awk/sed组合使用"),
        ("l2","文本处理","grep/awk/sed分别干嘛？","grep：搜索匹配的行\n```bash\ngrep -i 'error' log    # 忽略大小写\ngrep -rn 'TODO' src/   # 递归搜索+显示行号\ngrep -c 'error' log    # 统计匹配行数\n```\n\nawk：按列处理文本\n```bash\nawk '{print $1,$3}' file    # 打印第1和第3列\nawk -F: '{print $1}' /etc/passwd  # 指定分隔符\n```\n\nsed：流编辑（替换/删除）\n```bash\nsed 's/old/new/g' file  # 替换\nsed -n '5,10p' file     # 打印5-10行\n```","awk处理列，grep处理行，sed替换文本"),
        ("l3","进程管理","怎么查看和管理进程？","```bash\n# 查看所有进程\nps aux | grep python\n\n# 实时监控（类似任务管理器）\ntop\nhtop  # 更好用的版本\n\n# 杀死进程\nkill PID        # 优雅退出\nkill -9 PID     # 强制杀死\n\n# 后台运行\nnohup python app.py &\n# 或用screen/tmux\n\n# 查看端口占用\nlsof -i :8080\nnetstat -tlnp | grep 8080\nss -tlnp | grep 8080\n```","kill -9 是SIGKILL强制终止，kill默认SIGTERM优雅终止"),
        ("l4","权限","文件权限chmod怎么用？","```\n-rwxr-xr--  owner group other\n r=4 w=2 x=1\n\n chmod 755 file\n → owner: rwx(7) group: r-x(5) other: r-x(5)\n\n chmod u+x file   # 给owner加执行权限\n chmod g-w file   # 去掉group写权限\n chmod a+r file   # 所有人加读权限\n```\n\n常见权限：\n755：脚本/目录（owner可读写执行，其他人可读执行）\n644：普通文件（owner可读写，其他人只读）","面试常问：新建文件默认权限？→ 由umask决定，通常022"),
        ("l5","Shell","Shell脚本基础","```bash\n#!/bin/bash\n\n# 变量\nname=\"hello\"\necho $name\n\n# 条件\nif [ $age -gt 18 ]; then\n    echo \"adult\"\nfi\n\n# 循环\nfor i in {1..10}; do\n    echo $i\ndone\n\n# 函数\ngreet() {\n    echo \"Hello $1\"\n}\ngreet \"World\"\n\n# 常用判断\n-f 文件存在  -d 目录存在\n-z 字符串为空  -n 字符串非空\n-eq 等于  -gt 大于  -lt 小于\n```","#!/bin/bash 叫shebang，告诉系统用什么解释器"),
        ("l6","网络","Linux网络排查命令？","```bash\n# 测试连通性\nping google.com\n\n# DNS解析\nnslookup google.com\ndig google.com\n\n# 查看路由\ntraceroute google.com\n\n# 查看网络连接\nnetstat -tlnp    # 监听的端口\nss -tlnp         # 更快的版本\n\n# 抓包\ntcpdump -i eth0 port 80\n\n# HTTP请求\ncurl -v http://api.com/users\ncurl -X POST -d '{\"name\":\"x\"}' -H 'Content-Type: application/json' url\n```","curl是接口测试的好工具，-v显示详细请求过程"),
        ("l7","日志","怎么查看和分析日志？","```bash\n# 实时查看日志\ntail -f app.log\n\n# 最后100行\ntail -100 app.log\n\n# 搜索错误\ngrep 'ERROR' app.log\n\n# 统计每种错误出现次数\ngrep 'ERROR' app.log | awk '{print $NF}' | sort | uniq -c | sort -rn\n\n# 按时间范围查看\nawk '/2024-01-01 10:00/,/2024-01-01 11:00/' app.log\n\n# 查看日志文件大小\ndu -sh /var/log/*\nls -lhS /var/log/  # 按大小排序\n```","sort | uniq -c | sort -rn 是统计排序的经典组合"),
        ("l8","磁盘","磁盘空间不够怎么排查？","```bash\n# 查看磁盘使用\ndf -h\n\n# 查看目录大小\ndu -sh /var/*\ndu -h --max-depth=1 /\n\n# 找大文件\nfind / -size +100M -type f\n\n# 查看已删除但未释放的文件\nlsof | grep deleted\n\n# 清理\n# 清空日志（不删文件）\n> /var/log/large.log\n# 或 truncate -s 0 file\n\n# 清理包缓存\napt clean  # Debian\nyum clean all  # CentOS\n```","直接rm大文件如果进程还在用，空间不会释放，用truncate"),
        ("l9","系统","怎么查看系统资源使用情况？","```bash\n# CPU和内存\ntop\nhtop\nfree -h       # 内存使用\n\n# CPU核数\nnproc\nlscpu\n\n# 系统负载\nuptime\n# load average: 0.5, 0.3, 0.2\n# 1分钟/5分钟/15分钟平均负载\n# 一般不超过CPU核数\n\n# 网络流量\niftop\nnethogs  # 按进程查看\n\n# I/O\niostat\niotop    # 按进程查看I/O\n```","load average超过CPU核数说明系统过载"),
        ("l10","实用","管道和重定向？","管道 |：把前一个命令的输出作为后一个命令的输入\n```bash\ncat log | grep error | wc -l\nps aux | grep python | awk '{print $2}'\n```\n\n重定向：\n```bash\n> file     # 覆盖写入\n>> file    # 追加写入\n2>&1       # 错误输出合并到标准输出\n\n# 同时输出到屏幕和文件\ncommand | tee output.log\n\n# 丢弃输出\ncommand > /dev/null 2>&1\n```","管道是Linux哲学的核心：小工具组合解决大问题"),
    ]
    for c in linux:
        cards.append((c[0], 6, c[1], c[2], c[3], c[4]))

    conn.executemany(
        "INSERT INTO cards (id, deck_id, category, question, answer, tips) VALUES (?,?,?,?,?,?)",
        cards
    )
    conn.commit()

# ── API Routes ──
def seed_users(conn):
    """创建初始账号，账号密码从 .env 读取"""
    users = [
        (os.environ.get("ADMIN1_USER", "admin"), os.environ.get("ADMIN1_PASS", "admin123")),
        (os.environ.get("ADMIN2_USER", ""), os.environ.get("ADMIN2_PASS", "")),
    ]
    for username, password in users:
        if username:
            conn.execute(
                "INSERT OR IGNORE INTO users (username, password_hash) VALUES (?, ?)",
                (username, hash_pw(password))
            )

# ── Auth ──
@app.route("/api/login", methods=["POST"])
def login():
    data = request.json or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")
    if not username or not password:
        return jsonify({"error": "请填写账号和密码"}), 400
    conn = get_db()
    user = conn.execute(
        "SELECT id FROM users WHERE username=? AND password_hash=?",
        (username, hash_pw(password))
    ).fetchone()
    conn.close()
    if not user:
        return jsonify({"error": "账号或密码错误"}), 401
    token = jwt_encode({"sub": username, "exp": int(time.time()) + 86400 * 30})
    return jsonify({"token": token, "username": username})

@app.route("/api/decks", methods=["GET"])
def get_decks():
    conn = get_db()
    decks = conn.execute("SELECT * FROM decks ORDER BY id").fetchall()
    result = []
    for d in decks:
        cards = conn.execute(
            "SELECT id, category, question as q, answer as a, tips FROM cards WHERE deck_id=? ORDER BY rowid",
            (d["id"],)
        ).fetchall()
        result.append({"id": d["id"], "name": d["name"], "cards": [dict(c) for c in cards]})
    conn.close()
    return jsonify(result)

@app.route("/api/decks", methods=["POST"])
@require_auth
def create_deck():
    data = request.json
    conn = get_db()
    cur = conn.execute("INSERT INTO decks (name) VALUES (?)", (data["name"],))
    deck_id = cur.lastrowid
    if "cards" in data:
        for c in data["cards"]:
            conn.execute(
                "INSERT INTO cards (id, deck_id, category, question, answer, tips) VALUES (?,?,?,?,?,?)",
                (c.get("id", f"c_{deck_id}_{hash(c['q'])}"), deck_id, c.get("category",""), c["q"], c["a"], c.get("tips",""))
            )
    conn.commit()
    conn.close()
    return jsonify({"id": deck_id, "name": data["name"]}), 201

@app.route("/api/decks/<int:deck_id>", methods=["DELETE"])
@require_auth
def delete_deck(deck_id):
    if deck_id <= 6:  # protect default decks... or allow?
        pass
    conn = get_db()
    conn.execute("DELETE FROM cards WHERE deck_id=?", (deck_id,))
    conn.execute("DELETE FROM decks WHERE id=?", (deck_id,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})

@app.route("/api/cards", methods=["POST"])
@require_auth
def create_card():
    data = request.json
    conn = get_db()
    conn.execute(
        "INSERT OR REPLACE INTO cards (id, deck_id, category, question, answer, tips) VALUES (?,?,?,?,?,?)",
        (data.get("id", f"m_{hash(data['q'])}"), data["deck_id"], data.get("category",""), data["q"], data["a"], data.get("tips",""))
    )
    conn.commit()
    conn.close()
    return jsonify({"ok": True}), 201

@app.route("/api/cards/<card_id>", methods=["PUT"])
@require_auth
def update_card(card_id):
    data = request.json
    conn = get_db()
    conn.execute(
        "UPDATE cards SET category=?, question=?, answer=?, tips=? WHERE id=?",
        (data.get("category",""), data["q"], data["a"], data.get("tips",""), card_id)
    )
    conn.commit()
    conn.close()
    return jsonify({"ok": True})

@app.route("/api/cards/<card_id>", methods=["DELETE"])
@require_auth
def delete_card(card_id):
    conn = get_db()
    conn.execute("DELETE FROM cards WHERE id=?", (card_id,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})

@app.route("/api/scores", methods=["GET"])
def get_scores():
    username = get_username()
    if not username:
        return jsonify({})
    conn = get_db()
    rows = conn.execute("SELECT card_id, result FROM scores WHERE username = ?", (username,)).fetchall()
    conn.close()
    return jsonify({r["card_id"]: r["result"] for r in rows})

@app.route("/api/scores", methods=["POST"])
def update_score():
    username = get_username()
    if not username:
        return jsonify({"error": "未登录"}), 401
    data = request.json
    conn = get_db()
    conn.execute(
        "INSERT OR REPLACE INTO scores (username, card_id, result, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
        (username, data["card_id"], data["result"])
    )
    conn.commit()
    conn.close()
    return jsonify({"ok": True})

@app.route("/api/reset", methods=["POST"])
@require_auth
def reset_all():
    conn = get_db()
    conn.execute("DELETE FROM scores WHERE username = ?", (g.username,))
    conn.execute("DELETE FROM cards")
    conn.execute("DELETE FROM decks")
    seed_default_data(conn)
    conn.commit()
    conn.close()
    return jsonify({"ok": True})

@app.route("/api/ai", methods=["POST"])
@require_auth
def ai_proxy():
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key or api_key == "你的Key填这里":
        return jsonify({"error": "未配置 ANTHROPIC_API_KEY"}), 500
    body = request.get_data()
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=body,
        headers={
            "Content-Type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return Response(resp.read(), status=resp.status, content_type="application/json")
    except urllib.error.HTTPError as e:
        return Response(e.read(), status=e.code, content_type="application/json")


@app.route("/")
def index():
    return app.send_static_file("index.html")

init_db()

if __name__ == "__main__":
    print("🧠 八股文速记 running at http://localhost:5000")
    print("   数据库:", DB_PATH)
    app.run(debug=True, port=5000, use_reloader=False)
