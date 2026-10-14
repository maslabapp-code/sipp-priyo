"use client";

import { useEffect, useMemo, useState } from "react";
import { useAutoRefresh } from "@/components/layout/DataSync";
import { fetchJson } from "@/lib/api-client";
import {
  INVOICE_GRUP,
  INVOICE_PERUSAHAAN,
  INVOICE_PPN_DEFAULT,
  alamatAwalCustomer,
  grupDariSj,
  hitungInvoice,
  type InvoiceGrup,
  type InvoiceLine,
} from "@/lib/invoice-const";
import { terbilangRupiah } from "@/lib/terbilang";

type Customer = { id: string; nama: string };
type SjItem = { partId: string | null; namaBarang: string; qty: number; kategori: string | null; harga: number };
type Sj = { id: string; noSj: string; jenis: string; tanggal: string; items: SjItem[] };
type Line = { key: string; grup: InvoiceGrup; nama: string; qtys: number[]; hargaMaster: number };

const fmt = (n: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(n);
const rp = (n: number) => "Rp " + fmt(n);
const isoHariIni = () => new Date().toISOString().slice(0, 10);
const awalBulan = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1, 12).toISOString().slice(0, 10);
};
const fmtTgl = (iso: string) => new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });

const KEY_ALAMAT = (id: string) => `mtp-invoice-alamat:${id}`;

export function Invoice() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [dari, setDari] = useState(awalBulan());
  const [sampai, setSampai] = useState(isoHariIni());
  const [sjs, setSjs] = useState<Sj[]>([]);
  const [pilih, setPilih] = useState<Set<string>>(new Set());
  const [sudahCari, setSudahCari] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [noInvoice, setNoInvoice] = useState("");
  const [tanggal, setTanggal] = useState(isoHariIni());
  const [noSuratJalan, setNoSuratJalan] = useState("-");
  const [noPo, setNoPo] = useState("");
  const [alamat, setAlamat] = useState("");
  const [ppn, setPpn] = useState(String(INVOICE_PPN_DEFAULT));
  const [ttd, setTtd] = useState(INVOICE_PERUSAHAAN.penandatangan);
  const [hargaUbah, setHargaUbah] = useState<Record<string, string>>({});
  const [dibuang, setDibuang] = useState<Set<string>>(new Set());
  const [mengunduh, setMengunduh] = useState(false);
  const [errorUnduh, setErrorUnduh] = useState("");
  const [fokusNoInvoice, setFokusNoInvoice] = useState(false);

  const inputStyle: React.CSSProperties = { background: "var(--surface)", color: "var(--text-primary)", border: "1px solid var(--border)" };

  useEffect(() => {
    fetchJson<Customer[]>("/api/customers")
      .then(setCustomers)
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat customer"));
  }, []);

  // Daftar customer ikut diperbarui otomatis (pilihan dan isian yang sedang dikerjakan tidak berubah)
  useAutoRefresh(async () => {
    setCustomers(await fetchJson<Customer[]>("/api/customers"));
  });

  function pilihCustomer(id: string) {
    setCustomerId(id);
    setSjs([]);
    setPilih(new Set());
    setSudahCari(false);
    const c = customers.find((x) => x.id === id);
    let simpan: string | null = null;
    try {
      simpan = localStorage.getItem(KEY_ALAMAT(id));
    } catch {
      // penyimpanan browser tidak tersedia, pakai alamat awal
    }
    setAlamat(simpan ?? (c ? alamatAwalCustomer(c.nama) : ""));
  }

  function ubahAlamat(v: string) {
    setAlamat(v);
    if (!customerId) return;
    try {
      localStorage.setItem(KEY_ALAMAT(customerId), v);
    } catch {
      // abaikan
    }
  }

  async function cariSj() {
    if (!customerId) {
      setError("Pilih customer dulu");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const d = await fetchJson<{ sjs: Sj[]; noPo: string }>(`/api/invoice/sj?customerId=${customerId}&dari=${dari}&sampai=${sampai}`);
      setSjs(d.sjs);
      setPilih(new Set(d.sjs.map((s) => s.id)));
      setNoPo(d.noPo ?? "");
      setHargaUbah({});
      setDibuang(new Set());
      setSudahCari(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat Surat Jalan");
    } finally {
      setLoading(false);
    }
  }

  function togglePilih(id: string) {
    setPilih((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  // Gabungkan item semua SJ terpilih: satu baris per part per kelompok, qty dijumlah per SJ
  const lines: Line[] = useMemo(() => {
    const map = new Map<string, Line>();
    for (const sj of sjs) {
      if (!pilih.has(sj.id)) continue;
      for (const it of sj.items) {
        if (!(it.qty > 0)) continue;
        const grup = grupDariSj(sj.jenis, it.kategori);
        const key = `${grup}|${it.partId ?? it.namaBarang}`;
        const ada = map.get(key);
        if (ada) ada.qtys.push(it.qty);
        else map.set(key, { key, grup, nama: it.namaBarang, qtys: [it.qty], hargaMaster: it.harga });
      }
    }
    return [...map.values()].sort((a, b) => INVOICE_GRUP.indexOf(a.grup) - INVOICE_GRUP.indexOf(b.grup) || a.nama.localeCompare(b.nama, "id", { sensitivity: "base" }));
  }, [sjs, pilih]);

  const hargaDari = (l: Line) => {
    const v = hargaUbah[l.key];
    if (v === undefined) return l.hargaMaster;
    const n = Number(v.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  };

  const aktif: InvoiceLine[] = lines.filter((l) => !dibuang.has(l.key)).map((l) => ({ grup: l.grup, nama: l.nama, qtys: l.qtys, harga: hargaDari(l) }));
  const ppnPersen = Number(ppn.replace(",", ".")) || 0;
  const hasil = hitungInvoice(aktif, ppnPersen);
  const tanpaHarga = lines.filter((l) => !dibuang.has(l.key) && hargaDari(l) <= 0);

  async function unduh() {
    setErrorUnduh("");
    setFokusNoInvoice(false);
    if (!noInvoice.trim()) {
      setErrorUnduh("No. Invoice wajib diisi dulu (kolom di bagian \"2. Data invoice\").");
      setFokusNoInvoice(true);
      document.getElementById("invoice-no")?.scrollIntoView({ behavior: "smooth", block: "center" });
      document.getElementById("invoice-no")?.focus();
      return;
    }
    if (aktif.length === 0) {
      setErrorUnduh("Belum ada barang di invoice. Centang minimal satu SJ.");
      return;
    }
    if (tanpaHarga.length > 0 && !confirm(`${tanpaHarga.length} barang harganya masih 0. Tetap buat invoice?`)) return;
    setMengunduh(true);
    try {
      let res: Response;
      try {
        res = await fetch("/api/invoice/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ meta: { noInvoice, tanggal, noSuratJalan, noPo, alamat, ppnPersen, penandatangan: ttd }, lines: aktif }),
        });
      } catch {
        throw new Error("Tidak bisa terhubung ke server. Cek apakah aplikasinya masih jalan, lalu coba lagi.");
      }
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error ?? `Server merespons dengan error (kode ${res.status}).`);
      }
      const blob = await res.blob();
      if (blob.size === 0) throw new Error("File yang diterima kosong. Coba lagi.");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Invoice ${noInvoice.trim().replace(/[\\/:*?"<>|]/g, "-")}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setErrorUnduh(e instanceof Error ? e.message : "Gagal membuat invoice");
    } finally {
      setMengunduh(false);
    }
  }

  const label = "text-[12px] mb-1 block";
  const lblStyle = { color: "var(--text-secondary)" };
  let nomor = 0;

  return (
    <div className="p-5 max-w-[1100px]">
      <h1 className="text-[15px] font-semibold">Invoice</h1>
      <p className="text-[12.5px] mb-4" style={{ color: "var(--text-secondary)" }}>
        Susun invoice dari Surat Jalan Keluar. Qty diambil dari SJ, harga dari Master Part, hasilnya file Excel dengan format invoice yang sekarang dipakai.
      </p>

      {error && (
        <div className="mb-3 px-3 py-2 rounded-md text-[12.5px]" style={{ background: "#fdecea", color: "#a93226", border: "1px solid #f5c6c0" }}>
          {error}
        </div>
      )}

      {/* 1. Pilih customer & periode */}
      <div className="rounded-lg p-4 mb-4" style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
        <div className="text-[13px] font-medium mb-3">1. Pilih customer dan periode SJ</div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className={label} style={lblStyle}>Customer</label>
            <select value={customerId} onChange={(e) => pilihCustomer(e.target.value)} className="h-9 px-2 rounded-md text-[13px] w-64" style={inputStyle}>
              <option value="">— pilih customer —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.nama}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={label} style={lblStyle}>SJ dari tanggal</label>
            <input type="date" value={dari} onChange={(e) => setDari(e.target.value)} className="h-9 px-2 rounded-md text-[13px]" style={inputStyle} />
          </div>
          <div>
            <label className={label} style={lblStyle}>sampai tanggal</label>
            <input type="date" value={sampai} onChange={(e) => setSampai(e.target.value)} className="h-9 px-2 rounded-md text-[13px]" style={inputStyle} />
          </div>
          <button onClick={cariSj} disabled={loading} className="h-9 px-4 rounded-md text-[12.5px] font-medium text-white cursor-pointer disabled:opacity-60" style={{ background: "var(--accent)" }}>
            {loading ? "Memuat..." : "Tampilkan SJ"}
          </button>
        </div>

        {sudahCari && sjs.length === 0 && (
          <p className="text-[12.5px] mt-3" style={{ color: "var(--text-muted)" }}>Tidak ada Surat Jalan Keluar untuk customer ini pada periode tersebut.</p>
        )}

        {sjs.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center gap-3 mb-2 text-[12.5px]">
              <span style={{ color: "var(--text-secondary)" }}>{pilih.size} dari {sjs.length} SJ dipakai.</span>
              <button className="underline cursor-pointer" onClick={() => setPilih(new Set(sjs.map((s) => s.id)))}>Pilih semua</button>
              <button className="underline cursor-pointer" onClick={() => setPilih(new Set())}>Kosongkan</button>
            </div>
            <div className="rounded-md overflow-auto max-h-56" style={{ border: "1px solid var(--border)" }}>
              <table className="text-[12.5px] w-full border-collapse">
                <thead>
                  <tr style={{ background: "var(--surface-muted)", color: "var(--text-secondary)" }}>
                    <th className="px-2 py-1.5 w-8"></th>
                    <th className="px-2 py-1.5 text-left">No. SJ</th>
                    <th className="px-2 py-1.5 text-left">Tanggal</th>
                    <th className="px-2 py-1.5 text-left">Jenis</th>
                    <th className="px-2 py-1.5 text-right">Item</th>
                    <th className="px-2 py-1.5 text-right">Total qty</th>
                  </tr>
                </thead>
                <tbody>
                  {sjs.map((s) => (
                    <tr key={s.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td className="px-2 py-1 text-center"><input type="checkbox" checked={pilih.has(s.id)} onChange={() => togglePilih(s.id)} /></td>
                      <td className="px-2 py-1 font-mono-num">{s.noSj}</td>
                      <td className="px-2 py-1">{fmtTgl(s.tanggal)}</td>
                      <td className="px-2 py-1">{s.jenis === "P" ? "Produksi" : s.jenis === "J" ? "Jasa" : "WIP"}</td>
                      <td className="px-2 py-1 text-right font-mono-num">{s.items.length}</td>
                      <td className="px-2 py-1 text-right font-mono-num">{fmt(s.items.reduce((a, i) => a + i.qty, 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 2. Data invoice */}
      {sjs.length > 0 && (
        <div className="rounded-lg p-4 mb-4" style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
          <div className="text-[13px] font-medium mb-3">2. Data invoice</div>
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            <div>
              <label className={label} style={lblStyle}>No. Invoice *</label>
              <input id="invoice-no" value={noInvoice} onChange={(e) => { setNoInvoice(e.target.value); setFokusNoInvoice(false); }} placeholder="mis. GKMA-044" className="w-full h-9 px-2.5 rounded-md text-[13px]" style={{ ...inputStyle, borderColor: fokusNoInvoice ? "#c0392b" : undefined, boxShadow: fokusNoInvoice ? "0 0 0 2px #f5c6c0" : undefined }} />
            </div>
            <div>
              <label className={label} style={lblStyle}>Tanggal invoice</label>
              <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} className="w-full h-9 px-2 rounded-md text-[13px]" style={inputStyle} />
            </div>
            <div>
              <label className={label} style={lblStyle}>No. Surat Jalan</label>
              <input value={noSuratJalan} onChange={(e) => setNoSuratJalan(e.target.value)} className="w-full h-9 px-2.5 rounded-md text-[13px]" style={inputStyle} />
            </div>
            <div>
              <label className={label} style={lblStyle}>No. PO</label>
              <input value={noPo} onChange={(e) => setNoPo(e.target.value)} className="w-full h-9 px-2.5 rounded-md text-[13px]" style={inputStyle} />
            </div>
            <div>
              <label className={label} style={lblStyle}>PPN (%)</label>
              <input value={ppn} onChange={(e) => setPpn(e.target.value)} inputMode="decimal" className="w-full h-9 px-2.5 rounded-md text-[13px]" style={inputStyle} />
            </div>
            <div>
              <label className={label} style={lblStyle}>Penandatangan</label>
              <input value={ttd} onChange={(e) => setTtd(e.target.value)} className="w-full h-9 px-2.5 rounded-md text-[13px]" style={inputStyle} />
            </div>
          </div>
          <div className="mt-3">
            <label className={label} style={lblStyle}>Kepada Yth (baris pertama = nama customer; tersimpan di browser ini untuk customer tersebut)</label>
            <textarea value={alamat} onChange={(e) => ubahAlamat(e.target.value)} rows={5} className="w-full px-2.5 py-2 rounded-md text-[13px]" style={inputStyle} />
          </div>
        </div>
      )}

      {/* 3. Barang */}
      {sjs.length > 0 && (
        <div className="rounded-lg p-4 mb-4" style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
          <div className="text-[13px] font-medium mb-1">3. Cek barang dan harga</div>
          <p className="text-[12px] mb-3" style={{ color: "var(--text-secondary)" }}>
            Harga mengikuti Master Part. Kalau perlu diubah, ketik langsung di kolom harga (hanya berlaku untuk invoice ini, Master Part tidak berubah). Klik × untuk mengeluarkan barang dari invoice.
          </p>

          {tanpaHarga.length > 0 && (
            <div className="mb-3 px-3 py-2 rounded-md text-[12.5px]" style={{ background: "#fff6e0", color: "#8a6100", border: "1px solid #f1dca2" }}>
              {tanpaHarga.length} barang belum punya harga (Rp 0): {tanpaHarga.slice(0, 4).map((l) => l.nama).join(", ")}{tanpaHarga.length > 4 ? ", ..." : ""}. Isi harganya di bawah atau di Master Part.
            </div>
          )}

          <div className="rounded-md overflow-auto" style={{ border: "1px solid var(--border)" }}>
            <table className="text-[12.5px] w-full border-collapse">
              <thead>
                <tr style={{ background: "var(--surface-muted)", color: "var(--text-secondary)" }}>
                  <th className="px-2 py-1.5 w-10 text-left">No</th>
                  <th className="px-2 py-1.5 text-left">Nama Barang</th>
                  <th className="px-2 py-1.5 text-right">Qty</th>
                  <th className="px-2 py-1.5 text-right w-36">Harga/Pcs</th>
                  <th className="px-2 py-1.5 text-right">Total</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {INVOICE_GRUP.map((g) => {
                  const isi = lines.filter((l) => l.grup === g && !dibuang.has(l.key));
                  if (isi.length === 0) return null;
                  return [
                    <tr key={g} style={{ borderTop: "1px solid var(--border)", background: "var(--surface-muted)" }}>
                      <td colSpan={6} className="px-2 py-1 font-semibold">{g}</td>
                    </tr>,
                    ...isi.map((l) => {
                      const qty = l.qtys.reduce((a, b) => a + b, 0);
                      const harga = hargaDari(l);
                      nomor++;
                      return (
                        <tr key={l.key} style={{ borderTop: "1px solid var(--border)" }}>
                          <td className="px-2 py-1 font-mono-num" style={{ color: "var(--text-muted)" }}>{nomor}</td>
                          <td className="px-2 py-1">
                            {l.nama}
                            {l.qtys.length > 1 && <div className="text-[11px] font-mono-num" style={{ color: "var(--text-muted)" }}>{l.qtys.join(" + ")}</div>}
                          </td>
                          <td className="px-2 py-1 text-right font-mono-num">{fmt(qty)}</td>
                          <td className="px-2 py-1 text-right">
                            <input
                              value={hargaUbah[l.key] ?? String(l.hargaMaster)}
                              onChange={(e) => setHargaUbah((h) => ({ ...h, [l.key]: e.target.value }))}
                              inputMode="decimal"
                              className="w-28 h-7 px-2 rounded text-right font-mono-num"
                              style={{ ...inputStyle, borderColor: harga <= 0 ? "#e0a800" : undefined }}
                            />
                          </td>
                          <td className="px-2 py-1 text-right font-mono-num">{fmt(qty * harga)}</td>
                          <td className="text-center">
                            <button onClick={() => setDibuang((d) => new Set(d).add(l.key))} className="w-6 h-6 rounded cursor-pointer" style={{ color: "var(--text-muted)" }} title="Keluarkan dari invoice">×</button>
                          </td>
                        </tr>
                      );
                    }),
                  ];
                })}
                {aktif.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-5 text-center" style={{ color: "var(--text-muted)" }}>Tidak ada barang. Pilih minimal satu SJ.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {dibuang.size > 0 && (
            <button className="mt-2 text-[12px] underline cursor-pointer" onClick={() => setDibuang(new Set())}>
              Kembalikan {dibuang.size} barang yang dikeluarkan
            </button>
          )}

          <div className="mt-4 ml-auto w-full max-w-sm text-[13px]">
            <div className="flex justify-between py-1"><span>Total qty</span><span className="font-mono-num">{fmt(hasil.jumlahQty)}</span></div>
            <div className="flex justify-between py-1"><span>Jumlah</span><span className="font-mono-num">{rp(hasil.jumlah)}</span></div>
            <div className="flex justify-between py-1"><span>PPN {ppnPersen}%</span><span className="font-mono-num">{rp(hasil.ppn)}</span></div>
            <div className="flex justify-between py-1.5 font-semibold" style={{ borderTop: "1px solid var(--border)" }}><span>Jumlah Total</span><span className="font-mono-num">{rp(hasil.total)}</span></div>
            <p className="text-[11.5px] italic mt-1" style={{ color: "var(--text-secondary)" }}># {terbilangRupiah(hasil.total)} #</p>
          </div>

          {errorUnduh && (
            <div className="mt-4 px-3 py-2 rounded-md text-[12.5px]" style={{ background: "#fdecea", color: "#a93226", border: "1px solid #f5c6c0" }}>
              {errorUnduh}
            </div>
          )}
          <div className="mt-4 flex justify-end">
            <button onClick={unduh} disabled={mengunduh || aktif.length === 0} className="h-9 px-4 rounded-md text-[12.5px] font-medium text-white cursor-pointer disabled:opacity-60" style={{ background: "var(--accent)" }}>
              {mengunduh ? "Membuat file..." : "Unduh Invoice (Excel)"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
