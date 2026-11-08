\set ON_ERROR_STOP 1
-- Uji jejak perubahan (jalankan setelah 10_uji_rls_modul.sql dan migrasi 21)
create or replace function pg_temp.harus(b boolean, pesan text) returns void language plpgsql as $$ begin if not coalesce(b,false) then raise exception 'GAGAL: %', pesan; end if; raise notice 'OK: %', pesan; end $$;
create or replace function pg_temp.sebagai(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); perform set_config('request.jwt.claims', '{"aal":"aal2"}', false); end $$;
grant execute on function pg_temp.sebagai(text), pg_temp.harus(boolean,text) to authenticated;
select pg_temp.sebagai('00000000-0000-0000-0000-00000000000a'); set role authenticated;
update jsa set pj_nama = 'Koordinator Baru';
reset role;
select pg_temp.harus((select sebelum->>'pj_nama' = 'Budi' and sesudah->>'pj_nama' = 'Koordinator Baru' and aktor = '00000000-0000-0000-0000-00000000000a' from jejak_perubahan where tabel='jsa' and aksi='ubah' order by id desc limit 1), 'jejak JSA: nilai lama, nilai baru, dan pelaku tercatat');
select pg_temp.harus((select count(*) from jejak_perubahan where tabel='jsa' and aksi='ubah' and sesudah ? 'diperbarui_pada') = 0, 'jejak hanya menyimpan kolom yang berubah');
select pg_temp.sebagai('00000000-0000-0000-0000-00000000000c'); set role authenticated;
select kirim_laporan('bahaya','fisik',(select id from unit where kode='IPSRS'),'Lantai licin anonim','Lorong',false,true,null,'ABCD-EFGH-JKLM',null,null,null);
reset role;
select pg_temp.harus((select aktor is null and not (sesudah ? 'kode_lacak_hash') and not (sesudah ? 'pelapor_id') from jejak_perubahan where tabel='laporan' and aksi='buat' order by id desc limit 1), 'laporan anonim: pelapor dan kode lacak TIDAK tercatat di jejak');
select pg_temp.sebagai('00000000-0000-0000-0000-00000000000b'); set role authenticated;
select pg_temp.harus((select count(*) from jejak_perubahan) = 0, 'jejak perubahan hanya dapat dibaca K3RS');
reset role;
select pg_temp.sebagai('00000000-0000-0000-0000-00000000000a'); set role authenticated;
update dokumen set tanggal_tinjau = current_date + 365, pemilik = 'Komite K3', catatan_revisi = 'Revisi LOTO' where id = '10000000-0000-0000-0000-000000000002';
select pg_temp.harus((select pemilik from dokumen where id='10000000-0000-0000-0000-000000000002') = 'Komite K3', 'metadata dokumen (pemilik, tanggal tinjau, catatan revisi) tersimpan');
reset role;
