-- =====================================================================
-- DATA CONTOH (FIKTIF) UNTUK UJI COBA — BUKAN DATA NYATA
-- Jalankan SETELAH 01_setup.sql dan 02_jadikan_admin.sql.
-- Semua baris diberi tanda contoh = true dan diawali "[CONTOH]".
-- Hapus kapan saja dengan:  delete from public.laporan where contoh;
-- =====================================================================
do $$
declare v_admin uuid; v_id uuid; i int := 0;
  r record;
begin
  select id into v_admin from public.profil where peran = 'k3rs' and aktif limit 1;
  if v_admin is null then raise exception 'Jalankan 02_jadikan_admin.sql dulu'; end if;
  for r in select * from (values
    ('bahaya','fisik','RAD','Lorong depan ruang tunggu','[CONTOH] Lantai basah karena atap bocor saat hujan, belum ada rambu',true,'tertutup',4,3,'rekayasa','Atap ditambal dan talang diganti; rambu dipasang selama perbaikan'),
    ('nyaris_celaka','biologi','IGD','Ruang tindakan','[CONTOH] Jarum bekas tertinggal di atas troli, hampir tertusuk',true,'terkendali_sementara',4,3,'administratif','Briefing ulang pembuangan jarum ke safety box'),
    ('bahaya','kimia','LAB','Ruang penyimpanan reagen','[CONTOH] Botol reagen tanpa label B3 di rak bawah',false,'dalam_tindak_lanjut',3,3,'administratif','Pelabelan ulang sedang berjalan'),
    ('bahaya','ergonomi','RANAP','Kamar perawatan','[CONTOH] Memindahkan pasien tanpa alat bantu geser',false,'ditugaskan',3,4,null,null),
    ('kejadian','psikososial','IGD','Meja triase','[CONTOH] Petugas dibentak dan diancam keluarga pengunjung',true,'ditugaskan',4,3,null,null),
    ('bahaya','mekanik','GIZI','Dapur','[CONTOH] Kabel blender terkelupas',false,'baru',null,null,null,null),
    ('bahaya','kebakaran','IPSRS','Ruang panel listrik','[CONTOH] Jalur evakuasi terhalang tumpukan kardus',true,'baru',null,null,null,null),
    ('bahaya','limbah','RANAP','Ruang perawat','[CONTOH] Safety box sudah penuh lebih dari 3/4',false,'tertutup',3,4,'substitusi','Diganti safety box ukuran lebih besar dan jadwal angkut ditambah'),
    ('bahaya','fisik','LAUNDRY','Area mesin cuci','[CONTOH] Suara mesin sangat bising sepanjang shift',false,'dalam_tindak_lanjut',3,4,'apd','Penyediaan penutup telinga sementara'),
    ('nyaris_celaka','mekanik','HD','Ruang hemodialisis','[CONTOH] Roda kursi pasien macet, hampir terjatuh',false,'baru',null,null,null,null),
    ('bahaya','biologi','CSSD','Area dekontaminasi','[CONTOH] Sarung tangan tebal robek, stok habis',false,'tidak_dilanjutkan',null,null,null,null),
    ('bahaya','kimia','KESLING','IPAL','[CONTOH] Bau klorin menyengat di ruang dosing',false,'ditugaskan',3,3,null,null)
  ) as t(jenis,kat,unit,lokasi,uraian,mendesak,status_akhir,d,p,lvl,tl) loop
    i := i + 1;
    insert into public.laporan(nomor, jenis, kategori_kode, unit_id, lokasi, uraian, mendesak, anonim, contoh,
                               tanggal_lapor, dibuat_pada)
    values ('CONTOH-' || lpad(i::text, 3, '0'), r.jenis, r.kat, (select id from public.unit where kode = r.unit),
            r.lokasi, r.uraian, r.mendesak, true, true, current_date - (20 - i), date_trunc('day', now()) - ((20 - i) || ' days')::interval)
    returning id into v_id;
    if r.status_akhir = 'tidak_dilanjutkan' then
      perform set_config('app.catatan', 'Duplikat laporan lain (contoh)', true);
      update public.laporan set status = 'tidak_dilanjutkan' where id = v_id;
      continue;
    end if;
    if r.status_akhir = 'baru' then continue; end if;
    update public.laporan set pj_id = v_admin, target_tanggal = current_date + 7, dampak = r.d, kemungkinan = r.p,
           status = 'ditugaskan' where id = v_id;
    if r.lvl is not null then
      insert into public.tindak_lanjut(laporan_id, oleh, uraian, level_pengendalian, bukti_teks)
      values (v_id, v_admin, r.tl, r.lvl::public.level_t, '[CONTOH] Foto sebelum-sesudah disimpan di unit');
      update public.laporan set level_pengendalian = r.lvl::public.level_t, status = 'dalam_tindak_lanjut' where id = v_id;
      if r.status_akhir in ('terkendali_sementara','tertutup') then
        update public.laporan set status = r.status_akhir::public.status_t where id = v_id;
      end if;
    end if;
  end loop;
end $$;
select status, count(*) from public.laporan where contoh group by 1 order by 1;
