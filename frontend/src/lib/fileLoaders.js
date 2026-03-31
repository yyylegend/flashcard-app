export async function loadPdf() {
  if (window.pdfjsLib) return window.pdfjsLib;
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload = () => {
      const l = window.pdfjsLib;
      l.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      res(l);
    };
    s.onerror = () => rej(new Error("pdf.js加载失败"));
    document.head.appendChild(s);
  });
}

export async function pdfTxt(f) {
  const lib = await loadPdf();
  const buf = await f.arrayBuffer();
  const pdf = await lib.getDocument({ data: buf }).promise;
  let t = "";
  for (let i = 1; i <= pdf.numPages && t.length < 30000; i++) {
    const p = await pdf.getPage(i);
    const c = await p.getTextContent();
    t += c.items.map(x => x.str).join(" ") + "\n\n";
  }
  return t.slice(0, 30000);
}

export async function docTxt(f) {
  return (await f.text()).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 30000);
}
