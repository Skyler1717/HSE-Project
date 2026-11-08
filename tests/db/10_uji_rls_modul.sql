\set ON_ERROR_STOP 1
-- pengguna uji
insert into auth.users(id,email) values
 ('00000000-0000-0000-0000-00000000000a','admin@rs.id'),('00000000-0000-0000-0000-00000000000b','pj.ipsrs@rs.id'),
 ('00000000-0000-0000-0000-00000000000c','petugas.ipsrs@rs.id'),('00000000-0000-0000-0000-00000000000d','pj.igd@rs.id'),('00000000-0000-0000-0000-00000000000e','baru@rs.id');
update public.profil set peran='k3rs', aktif=true where id='00000000-0000-0000-0000-00000000000a';
update public.profil set peran='pj_unit', unit_id=(select id from unit where kode='IPSRS'), aktif=true where id='00000000-0000-0000-0000-00000000000b';
update public.profil set peran='petugas', unit_id=(select id from unit where kode='IPSRS'), aktif=true where id='00000000-0000-0000-0000-00000000000c';
update public.profil set peran='pj_unit', unit_id=(select id from unit where kode='IGD'), aktif=true where id='00000000-0000-0000-0000-00000000000d';
create or replace function pg_temp.sebagai(u text) returns void language plpgsql as $$ begin
  perform set_config('request.jwt.claim.sub', u, false); perform set_config('request.jwt.claims', '{"aal":"aal2"}', false); end $$;
create or replace function pg_temp.harus(b boolean, pesan text) returns void language plpgsql as $$ begin if not coalesce(b,false) then raise exception 'GAGAL: %', pesan; end if; raise notice 'OK: %', pesan; end $$;
grant execute on function pg_temp.sebagai(text), pg_temp.harus(boolean,text) to authenticated, anon;

-- 1. JSA oleh PJ IPSRS
select pg_temp.sebagai('00000000-0000-0000-0000-00000000000b'); set role authenticated;
insert into jsa(pekerjaan, unit_id, langkah, pj_nama) values ('Ganti lampu plafon lorong', (select id from unit where kode='IPSRS'),
  '[{"langkah":"Pasang tangga","uraian_bahaya":"jatuh","dampak":4,"kemungkinan":3},{"langkah":"Lepas lampu","dampak":2,"kemungkinan":2}]', 'Budi');
select pg_temp.harus((select skor_maks from jsa limit 1) = 12, 'skor_maks JSA dihitung otomatis = 12');
select pg_temp.harus((select dibuat_oleh from jsa limit 1) = '00000000-0000-0000-0000-00000000000b', 'pencipta JSA tercatat');
do $$ begin insert into jsa(pekerjaan, unit_id) values ('Unit lain', (select id from unit where kode='IGD')); raise exception 'GAGAL: PJ bisa menulis JSA unit lain'; exception when insufficient_privilege then raise notice 'OK: PJ ditolak menulis JSA unit lain'; end $$;
do $$ begin insert into jsa(pekerjaan, unit_id, status) values ('Setujui sendiri', (select id from unit where kode='IPSRS'), 'disetujui'); raise exception 'GAGAL: PJ menyetujui sendiri'; exception when insufficient_privilege then raise notice 'OK: PJ tidak dapat menyetujui JSA'; end $$;
-- 2. petugas
reset role; select pg_temp.sebagai('00000000-0000-0000-0000-00000000000c'); set role authenticated;
select pg_temp.harus((select count(*) from jsa) = 1, 'petugas unit yang sama dapat membaca JSA unitnya');
do $$ begin insert into jsa(pekerjaan, unit_id) values ('Coba', (select id from unit where kode='IPSRS')); raise exception 'GAGAL: petugas membuat JSA'; exception when insufficient_privilege then raise notice 'OK: petugas tidak dapat membuat JSA'; end $$;
reset role; select pg_temp.sebagai('00000000-0000-0000-0000-00000000000d'); set role authenticated;
select pg_temp.harus((select count(*) from jsa) = 0, 'PJ unit lain tidak melihat JSA IPSRS');
-- 3. K3RS menyetujui
reset role; select pg_temp.sebagai('00000000-0000-0000-0000-00000000000a'); set role authenticated;
update jsa set status='disetujui', dibuat_oleh='00000000-0000-0000-0000-00000000000d';
select pg_temp.harus((select disetujui_oleh from jsa) = '00000000-0000-0000-0000-00000000000a' and (select dibuat_oleh from jsa) = '00000000-0000-0000-0000-00000000000b', 'K3RS menyetujui; pencipta tidak dapat dipalsukan');
-- 4. inspeksi & pemantauan
insert into inspeksi(templat, judul, unit_id, hasil) values ('umum','Inspeksi umum',(select id from unit where kode='IPSRS'),
  '[{"butir":"Lantai kering","nilai":"ya"},{"butir":"APAR","nilai":"tidak","catatan":"kosong"},{"butir":"Rambu","nilai":"ya"},{"butir":"x","nilai":"na"}]');
select pg_temp.harus((select skor_kepatuhan from inspeksi) = 66.67 and (select jumlah_temuan from inspeksi) = 1, 'kepatuhan inspeksi 66,67% dan 1 temuan');
insert into pemantauan(jenis, parameter, unit_id, nilai, satuan, ambang_maks) values ('lingkungan','kebisingan',(select id from unit where kode='IPSRS'), 91, 'dBA', 85);
insert into pemantauan(jenis, parameter, unit_id, jumlah_kasus, jumlah_diperiksa) values ('kesehatan','muskuloskeletal',(select id from unit where kode='IPSRS'), 4, 20);
select pg_temp.harus((select status from pemantauan where parameter='kebisingan') = 'melebihi', 'status pemantauan "melebihi" otomatis');
reset role; select pg_temp.sebagai('00000000-0000-0000-0000-00000000000c'); set role authenticated;
select pg_temp.harus((select count(*) from pemantauan) = 1 and (select jenis from pemantauan) = 'lingkungan', 'petugas hanya melihat pemantauan lingkungan, bukan data kesehatan');
reset role; select pg_temp.sebagai('00000000-0000-0000-0000-00000000000b'); set role authenticated;
select pg_temp.harus((select count(*) from pemantauan) = 2, 'PJ unit melihat data kesehatan agregat unitnya');
-- 5. akun pending
reset role; select pg_temp.sebagai('00000000-0000-0000-0000-00000000000e'); set role authenticated;
select pg_temp.harus((select count(*) from jsa) + (select count(*) from inspeksi) + (select count(*) from pemantauan) + (select count(*) from dokumen) = 0, 'akun pending tidak melihat data apa pun');
do $$ begin insert into ai_riwayat(kategori, kueri) values ('pencarian','x'); raise exception 'GAGAL: pending menyimpan riwayat'; exception when insufficient_privilege then raise notice 'OK: akun pending tidak dapat memakai HSE Intelligence'; end $$;
-- 6. laporan + antrean sinkron
reset role; select pg_temp.sebagai('00000000-0000-0000-0000-00000000000c'); set role authenticated;
select kirim_laporan('nyaris_celaka','fisik',(select id from unit where kode='IPSRS'),'Hampir jatuh dari tangga','Lorong',false,false,null,null,null,null,null);
reset role;
select pg_temp.harus((select count(*) from sinkron_antrean where tabel='laporan') = 1, 'laporan baru masuk antrean sinkron');
set role anon;
do $$ begin perform sinkron_ambil('salah', 10); raise exception 'GAGAL: token salah diterima'; exception when raise_exception then if sqlerrm like 'GAGAL%' then raise; end if; raise notice 'OK: token salah ditolak (%)', sqlerrm; end $$;
do $$ begin perform count(*) from laporan; raise exception 'GAGAL: anon membaca laporan'; exception when insufficient_privilege then raise notice 'OK: anon tidak dapat membaca tabel'; end $$;
reset role; select pg_temp.sebagai('00000000-0000-0000-0000-00000000000a'); set role authenticated;
select sinkron_atur_token('tokenrahasia-0123456789abcdef-0123456789');
reset role; set role anon;
select pg_temp.harus(jsonb_array_length(sinkron_ambil('tokenrahasia-0123456789abcdef-0123456789', 100)) >= 4, 'Apps Script mengambil antrean dengan token');
reset role;
select pg_temp.harus((select count(*) from sinkron_antrean where status <> 'diproses') = 0, 'baris ditandai diproses');
select pg_temp.harus(not exists (select 1 from jsonb_object_keys(fn_baris_sinkron('laporan', (select rec_id from sinkron_antrean where tabel='laporan'))) k where k in ('pelapor_id','kode_lacak_hash','id_klien','foto_path')), 'data sinkron tanpa identitas pelapor/kode lacak/foto');
select jsonb_agg(jsonb_build_object('antrean_id', id, 'ok', tabel <> 'inspeksi', 'galat', 'sheet penuh'))::text as hasil from sinkron_antrean \gset
set role anon;
select sinkron_lapor('tokenrahasia-0123456789abcdef-0123456789', :'hasil'::jsonb);
reset role;
select pg_temp.harus((select status from sinkron_antrean where tabel='inspeksi') = 'gagal' and (select count(*) from sinkron_antrean where status='terkirim') >= 3, 'hasil kirim dicatat: terkirim & gagal (dengan galat)');
update laporan set lokasi = 'Lorong lantai 2';
select pg_temp.harus((select count(*) from sinkron_antrean where tabel='laporan') = 1 and (select status from sinkron_antrean where tabel='laporan') = 'menunggu', 'perubahan laporan diantre ulang TANPA baris ganda');
update sinkron_antrean set diproses_pada = now() - interval '1 hour' where tabel='inspeksi';
set role anon;
select pg_temp.harus((select count(*) from jsonb_array_elements(sinkron_ambil('tokenrahasia-0123456789abcdef-0123456789', 100)) e where e->>'tabel'='inspeksi') = 1, 'baris gagal diambil ulang (retry)');
reset role;
-- 7. ringkasan bulanan sesuai hak (invoker)
select pg_temp.sebagai('00000000-0000-0000-0000-00000000000d'); set role authenticated;
select pg_temp.harus((ringkasan_bulanan(current_date)->>'laporan_total')::int = 0 and (ringkasan_bulanan(current_date)->>'jsa_jumlah')::int = 0, 'ringkasan bulanan PJ IGD tidak memuat data IPSRS');
reset role; select pg_temp.sebagai('00000000-0000-0000-0000-00000000000a'); set role authenticated;
select pg_temp.harus((ringkasan_bulanan(current_date)->>'laporan_total')::int = 1 and (ringkasan_bulanan(current_date)->>'inspeksi_temuan')::int = 1 and (ringkasan_bulanan(current_date)->>'pemantauan_melebihi')::int = 1, 'ringkasan bulanan K3RS: angka sesuai data');
select buat_laporan_bulanan(current_date, false); select buat_laporan_bulanan(current_date, false);
reset role;
select pg_temp.harus((select count(*) from laporan_bulanan) = 1, 'laporan bulanan tidak terduplikasi');
-- 8. riwayat AI
select pg_temp.sebagai('00000000-0000-0000-0000-00000000000c'); set role authenticated;
insert into ai_riwayat(kategori, kueri, pengguna_id, kedaluwarsa) values ('pencarian','near miss malam','00000000-0000-0000-0000-00000000000a', now() + interval '999 days');
select pg_temp.harus((select pengguna_id from ai_riwayat) = '00000000-0000-0000-0000-00000000000c' and (select kedaluwarsa::date - pada::date from ai_riwayat) = 60 and (select shift from ai_riwayat) is not null, 'riwayat: pemilik, retensi 60 hari, dan shift diisi server');
reset role; select pg_temp.sebagai('00000000-0000-0000-0000-00000000000b'); set role authenticated;
select pg_temp.harus((select count(*) from ai_riwayat) = 0, 'riwayat pengguna lain tidak terlihat');
reset role; update ai_riwayat set kedaluwarsa = now() - interval '1 day';
select pg_temp.sebagai('00000000-0000-0000-0000-00000000000c'); set role authenticated;
select pg_temp.harus((select count(*) from ai_riwayat) = 0, 'riwayat kedaluwarsa tidak ditampilkan');
-- 9. dokumen & pencarian
reset role; select pg_temp.sebagai('00000000-0000-0000-0000-00000000000a'); set role authenticated;
insert into dokumen(id, judul, nomor, versi) values ('10000000-0000-0000-0000-000000000001','SOP Pekerjaan Listrik','SOP/IPSRS/01','1');
insert into dokumen_bagian(dokumen_id, halaman, teks) values ('10000000-0000-0000-0000-000000000001', 2, 'Sebelum bekerja pada panel listrik lakukan lockout tagout dan pastikan tidak bertegangan.');
insert into dokumen(id, judul, nomor, versi, menggantikan) values ('10000000-0000-0000-0000-000000000002','SOP Pekerjaan Listrik','SOP/IPSRS/01','2','10000000-0000-0000-0000-000000000001');
insert into dokumen_bagian(dokumen_id, halaman, teks) values ('10000000-0000-0000-0000-000000000002', 3, 'Pekerjaan panel listrik wajib izin kerja dan LOTO.');
insert into dokumen(judul, status) values ('Pedoman rahasia lama','nonaktif');
select pg_temp.harus((select status from dokumen where id='10000000-0000-0000-0000-000000000001') = 'diganti', 'versi baru menandai versi lama "diganti"');
reset role; select pg_temp.sebagai('00000000-0000-0000-0000-00000000000c'); set role authenticated;
select pg_temp.harus((select count(*) from cari_dokumen('panel listrik', 10)) = 2 and (select status from cari_dokumen('panel listrik', 10) limit 1) = 'aktif', 'pencarian SOP: versi aktif di peringkat atas, versi lama tetap bertanda');
select pg_temp.harus((select count(*) from dokumen where judul like 'Pedoman rahasia%') = 0, 'dokumen nonaktif tidak terlihat petugas');
do $$ begin insert into dokumen(judul) values ('Coba'); raise exception 'GAGAL'; exception when insufficient_privilege then raise notice 'OK: petugas tidak dapat mengunggah dokumen'; end $$;
reset role;
select pg_temp.harus((select count(*) from log_aktivitas where aksi like 'jsa.%' or aksi like 'dokumen.%') >= 4, 'audit trail tercatat untuk JSA dan dokumen');
