\set ON_ERROR_STOP 1
-- Uji modul lanjutan (jalankan setelah 10 & 20). Pengguna: a,f=K3RS · b=PJ IPSRS · c=petugas IPSRS · d=PJ IGD · e=pending
create or replace function pg_temp.harus(b boolean, pesan text) returns void language plpgsql as $$ begin if not coalesce(b,false) then raise exception 'GAGAL: %', pesan; end if; raise notice 'OK: %', pesan; end $$;
create or replace function pg_temp.harus_gagal(q text, pesan text) returns void language plpgsql as $$
begin begin execute q; exception when others then raise notice 'OK: % [%]', pesan, left(sqlerrm, 90); return; end; raise exception 'GAGAL: % (tidak ditolak)', pesan; end $$;
create or replace function pg_temp.sebagai(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); perform set_config('request.jwt.claims', '{"aal":"aal2"}', false); end $$;
grant execute on function pg_temp.harus(boolean,text), pg_temp.harus_gagal(text,text), pg_temp.sebagai(text) to authenticated, anon;

insert into auth.users(id,email) values ('00000000-0000-0000-0000-00000000000f','admin2@rs.id') on conflict do nothing;
update public.profil set peran='k3rs', aktif=true where id='00000000-0000-0000-0000-00000000000f';
\set A '00000000-0000-0000-0000-00000000000a'
\set B '00000000-0000-0000-0000-00000000000b'
\set C '00000000-0000-0000-0000-00000000000c'
\set D '00000000-0000-0000-0000-00000000000d'
\set E '00000000-0000-0000-0000-00000000000e'
\set F '00000000-0000-0000-0000-00000000000f'
select id as nyaris from laporan where jenis='nyaris_celaka' limit 1 \gset
select id as bahaya from laporan where jenis='bahaya' limit 1 \gset
select id as jsa from jsa limit 1 \gset

-- ===== INVESTIGASI & RCA =====
select pg_temp.sebagai(:'C'); set role authenticated;
select pg_temp.harus_gagal(format('insert into investigasi(laporan_id, ketua_id) values (%L, %L)', :'nyaris', :'C'), 'petugas tidak dapat membuat investigasi');
reset role; select pg_temp.sebagai(:'B'); set role authenticated;
select pg_temp.harus_gagal(format('insert into investigasi(laporan_id, ketua_id) values (%L, %L)', :'bahaya', :'B'), 'investigasi ditolak untuk laporan bahaya biasa');
insert into investigasi(laporan_id, ketua_id, tim) values (:'nyaris', :'B', '[{"nama":"Teknisi A","peran":"anggota"}]') returning id as inv, unit_id as inv_unit, nomor as inv_no \gset
select pg_temp.harus(:'inv_no' like 'INV-%' and :inv_unit = (select unit_id from laporan where id = :'nyaris'), 'investigasi dibuat dari Incident ID yang benar (nomor otomatis, unit dari laporan)');
select pg_temp.harus_gagal(format('insert into investigasi(laporan_id, ketua_id) values (%L, %L)', :'nyaris', :'B'), 'tidak boleh dua investigasi aktif untuk laporan yang sama');
reset role; select pg_temp.sebagai(:'D'); set role authenticated;
select pg_temp.harus((select count(*) from investigasi) = 0, 'PJ unit lain tidak dapat membuka investigasi IPSRS');
reset role; select pg_temp.sebagai(:'C'); set role authenticated;
select pg_temp.harus((select count(*) from investigasi) = 0, 'petugas tidak dapat membuka investigasi');
reset role; select pg_temp.sebagai(:'B'); set role authenticated;
update investigasi set status = 'analisis' where id = :'inv';
select pg_temp.harus_gagal(format('update investigasi set status = %L where id = %L', 'menunggu_persetujuan', :'inv'), 'tidak dapat diajukan tanpa kronologi');
update investigasi set kronologi = '[{"waktu":"08:10","uraian":"Teknisi naik tangga"},{"waktu":"08:12","uraian":"Tangga tergelincir"}]', penyebab_langsung = 'Tangga tanpa kaki karet di lantai basah',
  penyebab_dasar = 'Tidak ada inspeksi tangga', lima_why = '[{"masalah":"Tangga tergelincir","why":["Lantai basah","Atap bocor","Talang rusak"],"akar":"Tidak ada program pemeliharaan talang","bukti":"Foto talang","tindakan":"Jadwal pemeliharaan"}]',
  fishbone = '{"masalah":"Tangga tergelincir","kategori":{"mesin":[{"teks":"Kaki tangga aus","sub":["Tidak diganti"],"akar":false}],"lingkungan":[{"teks":"Lantai basah","sub":[],"akar":false}]}}' where id = :'inv';
select pg_temp.harus((select lima_why->0->>'akar' from investigasi where id = :'inv') = 'Tidak ada program pemeliharaan talang' and (select jsonb_array_length(fishbone->'kategori'->'mesin'->0->'sub') from investigasi where id = :'inv') = 1, 'akar masalah 5 Why dan Fishbone (dengan sub-penyebab) tersimpan');
select pg_temp.harus_gagal(format('update investigasi set status = %L where id = %L', 'menunggu_persetujuan', :'inv'), 'tidak dapat diajukan tanpa CAPA');
insert into capa(sumber, investigasi_id, unit_id, akar_masalah, tindakan, jenis, level_pengendalian, prioritas, pj_id, target_tanggal)
values ('investigasi', :'inv', 1, 'Tidak ada program pemeliharaan talang', 'Buat jadwal pemeliharaan talang bulanan', 'preventif', 'administratif', 'tinggi', :'B', current_date + 14) returning id as capa, unit_id as capa_unit, laporan_id as capa_lap \gset
select pg_temp.harus(:capa_unit = :inv_unit and :'capa_lap' = :'nyaris', 'CAPA tertaut ke investigasi (unit dan Incident ID ikut otomatis)');
update investigasi set status = 'menunggu_persetujuan' where id = :'inv';
reset role;
select pg_temp.harus((select count(*) from notifikasi where kunci like 'inv_ajukan:%' and penerima_id in (:'A', :'F')) = 2, 'notifikasi "menunggu persetujuan" ke semua K3RS');
select pg_temp.sebagai(:'B'); set role authenticated;
select pg_temp.harus_gagal(format('update investigasi set status = %L where id = %L', 'disetujui', :'inv'), 'ketua/PJ tidak dapat menyetujui investigasinya sendiri');
reset role; select pg_temp.sebagai(:'A'); set role authenticated;
update investigasi set status = 'disetujui', catatan_persetujuan = 'Analisis memadai' where id = :'inv';
select pg_temp.harus((select disetujui_oleh from investigasi where id = :'inv') = :'A', 'persetujuan investigasi oleh K3RS tercatat');
select pg_temp.harus_gagal(format('update investigasi set akar_masalah = %L where id = %L', 'ubah diam-diam', :'inv'), 'isi investigasi terkunci setelah disetujui');
reset role; select pg_temp.sebagai(:'B'); set role authenticated;
select pg_temp.harus_gagal(format('update capa set status = %L where id = %L', 'selesai', :'capa'), 'CAPA tidak dapat ditandai selesai tanpa bukti');
update capa set status = 'selesai', bukti = 'Jadwal pemeliharaan diterbitkan dan dilaksanakan' where id = :'capa';
select pg_temp.harus_gagal(format('update capa set status = %L, hasil_verifikasi = %L where id = %L', 'terverifikasi', 'efektif sekali', :'capa'), 'PJ tidak dapat memverifikasi CAPA sendiri');
select pg_temp.harus_gagal(format('update capa set target_tanggal = %L where id = %L', '2030-01-01', :'capa'), 'PJ tidak dapat mengubah target/isi CAPA');
reset role; select pg_temp.sebagai(:'A'); set role authenticated;
update capa set status = 'terverifikasi', hasil_verifikasi = 'Tidak ada genangan selama 30 hari' where id = :'capa';
update investigasi set status = 'ditutup' where id = :'inv';
reset role;
select pg_temp.harus((select status from investigasi where id = :'inv') = 'ditutup' and (select capa_terbuka_saat_tutup from investigasi where id = :'inv') = 0, 'investigasi ditutup; jumlah CAPA terbuka saat tutup dicatat');
select pg_temp.harus((select count(*) from notifikasi where penerima_id = :'B' and kunci = 'capa_baru:' || :'capa') = 1 and (select count(*) from notifikasi where penerima_id = :'B' and kunci like 'capa_verif:%') = 1, 'notifikasi CAPA baru & CAPA terverifikasi ke PJ');
select pg_temp.harus((select count(*) from jejak_perubahan where tabel = 'investigasi' and rec_id = :'inv') >= 5, 'jejak perubahan investigasi tercatat');

-- ===== IZIN KERJA (PTW) =====
select pg_temp.sebagai(:'B'); set role authenticated;
insert into izin_kerja(jenis, pekerjaan, lokasi, unit_id, supervisor_id, mulai, selesai, jsa_id)
values ('listrik', 'Perbaikan panel lantai 2', 'Panel L2', (select unit_id from jsa where id = :'jsa'), :'D', now() - interval '10 minutes', now() + interval '4 hours', :'jsa') returning id as izin, nomor as izin_no \gset
select pg_temp.harus(:'izin_no' like 'PTW-%' and (select jsonb_array_length(ceklis) from izin_kerja where id = :'izin') = 9, 'PTW: nomor otomatis dan daftar periksa listrik disalin dari master');
select pg_temp.harus_gagal(format('update izin_kerja set status = %L where id = %L', 'aktif', :'izin'), 'status PTW tidak dapat diubah langsung');
select pg_temp.harus_gagal(format('select izin_proses(%L, %L)', :'izin', 'mulai'), 'PTW tidak dapat digunakan sebelum disahkan');
select pg_temp.harus_gagal(format('select izin_proses(%L, %L)', :'izin', 'ajukan'), 'PTW tidak dapat diajukan sebelum daftar periksa diisi');
update izin_kerja set ceklis = (select jsonb_agg(x || '{"nilai":"ya"}') from jsonb_array_elements(ceklis) x) where id = :'izin';
select izin_proses(:'izin', 'ajukan');
reset role; select pg_temp.harus((select count(*) from notifikasi where penerima_id = :'D' and kategori = 'izin') = 1, 'PTW diajukan → notifikasi ke supervisor');
select pg_temp.sebagai(:'A'); set role authenticated;
select pg_temp.harus_gagal(format('select izin_proses(%L, %L)', :'izin', 'setujui_supervisor'), 'hanya supervisor yang ditunjuk dapat meninjau');
reset role; select pg_temp.sebagai(:'D'); set role authenticated;
select izin_proses(:'izin', 'setujui_supervisor');
select pg_temp.harus_gagal(format('select izin_proses(%L, %L)', :'izin', 'setujui_k3'), 'tinjauan K3 hanya oleh K3RS');
reset role; select pg_temp.sebagai(:'A'); set role authenticated;
select izin_proses(:'izin', 'setujui_k3'); select izin_proses(:'izin', 'sahkan');
select pg_temp.harus((select status from izin_kerja where id = :'izin') = 'disahkan' and (select jsa_versi from izin_kerja where id = :'izin') is not null, 'PTW disahkan; versi JSA dicatat');
reset role; select pg_temp.sebagai(:'B'); set role authenticated;
select izin_proses(:'izin', 'mulai');
select pg_temp.harus_gagal(format('update izin_kerja set pekerjaan = %L where id = %L', 'ubah', :'izin'), 'isi PTW terkunci setelah diajukan');
reset role; select pg_temp.sebagai(:'C'); set role authenticated;
select pg_temp.harus((select count(*) from izin_kerja where id = :'izin') = 1, 'petugas unit melihat izin kerja yang relevan');
select izin_proses(:'izin', 'tangguhkan', 'Ditemukan kabel bertegangan di sebelah panel');
select pg_temp.harus((select status from izin_kerja where id = :'izin') = 'ditangguhkan', 'Stop Work Authority: petugas dapat menangguhkan izin');
select pg_temp.harus_gagal(format('select izin_proses(%L, %L, %L)', :'izin', 'lanjutkan', 'aman'), 'melanjutkan izin hanya oleh K3RS');
reset role; select pg_temp.sebagai(:'A'); set role authenticated;
select izin_proses(:'izin', 'lanjutkan', 'Kabel sebelah diisolasi');
update jsa set langkah = langkah || '[{"langkah":"Tambahan","dampak":2,"kemungkinan":2}]' where id = :'jsa';
select pg_temp.harus((select perlu_tinjau and status = 'ditangguhkan' from izin_kerja where id = :'izin'), 'JSA berubah setelah PTW disahkan → izin aktif ditangguhkan dan perlu ditinjau');
select pg_temp.harus((select count(*) from izin_jurnal where izin_id = :'izin' and aksi = 'jsa_berubah') = 1, 'perubahan JSA tercatat di jurnal izin');
select pg_temp.harus_gagal(format('select izin_proses(%L, %L, %L)', :'izin', 'lanjutkan', 'lanjut saja'), 'izin perlu tinjau tidak dapat dilanjutkan sebelum ditinjau ulang');
reset role;
select set_config('hse.izin_proses', '1', false);
update izin_kerja set mulai = now() - interval '5 hours', selesai = now() - interval '1 minute' where id = :'izin';
select set_config('hse.izin_proses', '', false);
select izin_periksa_kedaluwarsa() as n_kedaluwarsa \gset
select pg_temp.harus(:n_kedaluwarsa = 1 and (select status from izin_kerja where id = :'izin') = 'kedaluwarsa', 'izin lewat masa berlaku otomatis kedaluwarsa');
select pg_temp.sebagai(:'A'); set role authenticated;
select pg_temp.harus_gagal(format('select izin_proses(%L, %L, %L)', :'izin', 'lanjutkan', 'paksa'), 'izin kedaluwarsa tidak dapat diaktifkan kembali');
select pg_temp.harus_gagal(format('select izin_proses(%L, %L, %L)', :'izin', 'tutup', ''), 'penutupan izin wajib konfirmasi area aman');
select izin_proses(:'izin', 'tutup', 'Area dirapikan', '{"area_aman":true}');
select pg_temp.harus((select status from izin_kerja where id = :'izin') = 'ditutup' and (select count(*) from izin_jurnal where izin_id = :'izin') >= 8, 'izin ditutup; seluruh tahap tercatat di jurnal');
reset role; select pg_temp.sebagai(:'B'); set role authenticated;
insert into izin_kerja(jenis, pekerjaan, unit_id, supervisor_id, mulai, selesai, jsa_id) values ('ruang_terbatas', 'Masuk bak kontrol', (select unit_id from jsa where id = :'jsa'), :'D', now(), now() + interval '2 hours', :'jsa') returning id as izin2 \gset
update izin_kerja set ceklis = (select jsonb_agg(x || '{"nilai":"ya"}') from jsonb_array_elements(ceklis) x), uji_gas = '{"o2":18.0,"lel":2,"h2s":1,"co":3}' where id = :'izin2';
select pg_temp.harus_gagal(format('select izin_proses(%L, %L)', :'izin2', 'ajukan'), 'ruang terbatas: O2 18%% ditolak');
reset role; select pg_temp.sebagai(:'E'); set role authenticated;
select pg_temp.harus((select count(*) from izin_kerja) + (select count(*) from capa) + (select count(*) from kegiatan) = 0, 'akun pending tidak melihat izin, CAPA, atau kegiatan');
reset role;

-- ===== TOOLBOX & PELATIHAN =====
select pg_temp.sebagai(:'B'); set role authenticated;
insert into kegiatan(tipe, judul, unit_id, mulai, durasi_menit, lokasi) values ('toolbox', 'Bahaya listrik saat hujan', (select unit_id from profil where id = :'B'), now(), 20, 'Bengkel IPSRS') returning id as tbm, nomor as tbm_no \gset
insert into kegiatan_peserta(kegiatan_id, profil_id, nama) values (:'tbm', :'C', 'x');
reset role;
select pg_temp.harus(:'tbm_no' like 'TBM-%' and (select count(*) from notifikasi where penerima_id = :'C' and kunci like 'keg_undang:%') = 1, 'toolbox: nomor otomatis; peserta mendapat notifikasi undangan');
select pg_temp.sebagai(:'C'); set role authenticated;
select pg_temp.harus_gagal('select kode_hadir from kegiatan limit 1', 'peserta tidak dapat membaca kode QR kehadiran');
select pg_temp.harus((select count(*) from kegiatan_peserta) = 1, 'peserta melihat catatan kehadirannya sendiri');
update kegiatan_peserta set kehadiran = 'hadir' where kegiatan_id = :'tbm';
select pg_temp.harus((select kehadiran from kegiatan_peserta where kegiatan_id = :'tbm') = 'belum', 'peserta tidak dapat menandai kehadirannya sendiri secara langsung');
select pg_temp.harus_gagal(format('select kegiatan_hadir(%L)', 'kodesalah'), 'kode QR salah ditolak');
reset role; select kode_hadir as kode from kegiatan where id = :'tbm' \gset
select pg_temp.sebagai(:'C'); set role authenticated;
select kegiatan_hadir(:'kode');
select pg_temp.harus((select kehadiran = 'hadir' and cara_hadir = 'qr' from kegiatan_peserta where kegiatan_id = :'tbm'), 'presensi QR mencatat kehadiran');
reset role; select pg_temp.sebagai(:'B'); set role authenticated;
select pg_temp.harus_gagal(format('update kegiatan_peserta set nilai_pre = 50 where kegiatan_id = %L', :'tbm'), 'nilai hanya untuk pelatihan, bukan toolbox');
insert into capa(sumber, kegiatan_id, unit_id, tindakan, jenis, level_pengendalian, pj_id, target_tanggal) values ('toolbox', :'tbm', 1, 'Pasang penutup panel luar', 'korektif', 'rekayasa', :'B', current_date + 7);
reset role; select pg_temp.sebagai(:'A'); set role authenticated;
insert into kegiatan(tipe, judul, kategori, unit_id, mulai, durasi_menit, berlaku_bulan) values ('pelatihan', 'Pemadaman kebakaran dengan APAR', 'Kebakaran', 1, now() - interval '2 hours', 90, 24) returning id as trn \gset
insert into kegiatan_peserta(kegiatan_id, profil_id, nama, nilai_pre, nilai_post) values (:'trn', :'C', 'x', 40, 85) returning id as kp \gset
select pg_temp.harus((select nilai_pre = 40 and nilai_post = 85 from kegiatan_peserta where id = :kp), 'nilai pre-test dan post-test tersimpan di kolom masing-masing (tidak tertukar)');
select pg_temp.harus_gagal(format('update kegiatan_peserta set kompetensi = %L where id = %s', 'kompeten', :kp), 'kompetensi wajib berdasar metode asesmen');
select pg_temp.harus_gagal(format('update kegiatan_peserta set kompetensi = %L, metode_asesmen = %L where id = %s', 'kompeten', 'Praktik APAR', :kp), 'kehadiran ≠ kompetensi: peserta harus hadir dulu');
update kegiatan_peserta set kehadiran = 'hadir', kompetensi = 'kompeten', metode_asesmen = 'Praktik memadamkan api dengan APAR' where id = :kp;
select pg_temp.harus((select sertifikat_nomor like 'TRN-%' and sertifikat_berlaku_sampai > current_date + 700 from kegiatan_peserta where id = :kp), 'sertifikat otomatis untuk peserta kompeten, dengan masa berlaku');
reset role;

-- ===== NOTIFIKASI =====
select fn_notif(:'C', 'sistem', 'Uji idempoten', '', '', 'uji:1'); select fn_notif(:'C', 'sistem', 'Uji idempoten', '', '', 'uji:1');
select pg_temp.harus((select count(*) from notifikasi where kunci = 'uji:1') = 1 and (select count(*) from notifikasi_kirim k join notifikasi n on n.id = k.notifikasi_id where n.kunci = 'uji:1') = 1, 'peristiwa sama tidak menghasilkan notifikasi/email ganda');
insert into preferensi_notifikasi(profil_id, email, kategori_mati) values (:'C', false, '{kegiatan}');
select fn_notif(:'C', 'kegiatan', 'Info biasa', '', '', 'uji:2'); select fn_notif(:'C', 'kegiatan', 'Info wajib', '', '', 'uji:3', true);
select pg_temp.harus((select count(*) from notifikasi where kunci = 'uji:2') = 0 and (select count(*) from notifikasi where kunci = 'uji:3') = 1, 'kategori dimatikan dihormati, tetapi notifikasi wajib tetap terkirim');
select notifikasi_terjadwal() as n1 \gset
select count(*) as total1 from notifikasi \gset
select notifikasi_terjadwal();
select pg_temp.harus((select count(*) from notifikasi) = :total1, 'notifikasi terjadwal dijalankan dua kali tidak menggandakan');
update notifikasi_kirim set status = 'menunggu', percobaan = 0;
select jsonb_array_length(notif_ambil(500)) as diambil \gset
select pg_temp.harus(:diambil > 0 and (select count(*) from notifikasi_kirim where status = 'diproses') = :diambil, 'antrean email diambil dan ditandai diproses');
select pg_temp.harus(jsonb_array_length(notif_ambil(500)) = 0, 'baris yang sedang diproses tidak diambil dua kali');
select notif_lapor((select jsonb_agg(jsonb_build_object('kirim_id', id, 'status', 'gagal', 'galat', 'Resend 503')) from notifikasi_kirim));
select pg_temp.harus(jsonb_array_length(notif_ambil(500)) = 0, 'pengiriman gagal menunggu jeda sebelum dicoba ulang');
update notifikasi_kirim set diproses_pada = now() - interval '1 hour';
select pg_temp.harus(jsonb_array_length(notif_ambil(500)) = :diambil, 'pengiriman gagal dicoba ulang setelah jeda (retry)');
select notif_lapor((select jsonb_agg(jsonb_build_object('kirim_id', id, 'status', 'terkirim')) from notifikasi_kirim));
update notifikasi_kirim set diproses_pada = now() - interval '1 day';
select pg_temp.harus(jsonb_array_length(notif_ambil(500)) = 0 and (select count(*) from notifikasi_kirim where status = 'terkirim') = :diambil, 'yang sudah terkirim tidak pernah dikirim ulang');
select pg_temp.sebagai(:'C'); set role authenticated;
select pg_temp.harus((select count(*) from notifikasi where penerima_id <> :'C') = 0, 'pengguna hanya melihat notifikasinya sendiri');
select pg_temp.harus_gagal('update notifikasi set judul = ''x''', 'notifikasi tidak dapat diubah langsung');
select notif_tandai_dibaca(null);
select pg_temp.harus((select count(*) from notifikasi where dibaca_pada is null) = 0, 'tandai semua dibaca hanya untuk milik sendiri');
reset role; select pg_temp.harus((select count(*) from notifikasi where penerima_id = :'A' and dibaca_pada is not null) = 0, 'notifikasi pengguna lain tidak ikut ditandai');
select pg_temp.sebagai(:'C'); set role anon;
select pg_temp.harus_gagal('select notif_ambil(10)', 'antrean pengiriman tidak dapat diakses tanpa service role');
reset role;

-- ===== PAGINASI SISI SERVER =====
select pg_temp.sebagai(:'A'); set role authenticated;
select pg_temp.harus((daftar_pengguna_halaman('', '', '', 2, 0)->>'total')::int = (select count(*) from profil) and jsonb_array_length(daftar_pengguna_halaman('', '', '', 2, 0)->'baris') = 2, 'daftar pengguna berhalaman: total dan ukuran halaman benar');
select pg_temp.harus((daftar_pengguna_halaman('admin2', '', '', 25, 0)->>'total')::int = 1, 'pencarian pengguna di server');
reset role; select pg_temp.sebagai(:'B'); set role authenticated;
select pg_temp.harus_gagal('select daftar_pengguna_halaman()', 'daftar pengguna hanya untuk K3RS');
reset role;

-- ===== RLS LAPORAN: kebijakan cepat setara definisi lama (semua pengguna, dengan & tanpa MFA) =====
create temp table cek_rls(uid uuid, baru bigint, lama bigint); grant all on cek_rls to authenticated;
do $$ declare u record; i record; b bigint; l bigint; begin
  for u in select id from profil loop
    for i in select unnest(array['aal2','aal1']) loop
      perform set_config('request.jwt.claim.sub', u.id::text, false); perform set_config('request.jwt.claims', format('{"aal":"%s"}', i.unnest), false);
      execute 'set role authenticated'; select count(*) into b from laporan; execute 'reset role';
      select count(*) into l from laporan where fn_boleh_lihat(id); insert into cek_rls values (u.id, b, l);
    end loop;
  end loop; end $$;
select pg_temp.harus((select bool_and(baru = lama) from cek_rls) and (select count(*) from cek_rls) >= 12, 'kebijakan RLS laporan yang dioptimalkan setara dengan definisi lama untuk semua peran');
