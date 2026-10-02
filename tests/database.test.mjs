import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {validate} from '../site/lib/validation.mjs';
const db=new PGlite();
await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid primary key,email text,email_confirmed_at timestamptz); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; GRANT USAGE ON SCHEMA auth TO authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated; INSERT INTO auth.users VALUES ('00000000-0000-4000-8000-000000000001','owner@example.test',now()),('00000000-0000-4000-8000-000000000002','visitor@example.test',now()),('00000000-0000-4000-8000-000000000003','owner@example.test',null);`);
await db.exec(await fs.readFile(new URL('../supabase/setup.sql',import.meta.url),'utf8'));
await db.exec(`INSERT INTO public.exhibition_owners VALUES ('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000003');`);
const call=(overrides={})=>{const p={id:crypto.randomUUID(),phone:'+79991234567',name:'Иван Петров',inn:'7707083893',model:'UMO 5',quantity:3,website:'',...overrides};return db.query('SELECT public.submit_exhibition_request($1,$2,$3,$4,$5,$6,$7) AS result',[p.id,p.phone,p.name,p.inn,p.model,p.quantity,p.website]);};
const identity=async(n)=>{await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",['00000000-0000-4000-8000-'+String(n).padStart(12,'0')]);await db.exec('SET ROLE authenticated');};
test('database security and end-to-end submission',async()=>{
 await db.exec('SET ROLE anon');
 await assert.rejects(db.query('SELECT * FROM public.exhibition_requests'),/permission denied/);
 await assert.rejects(db.query('DELETE FROM public.exhibition_requests'),/permission denied/);
 await assert.rejects(db.query("INSERT INTO public.exhibition_requests(id,phone,name,inn,model,quantity) VALUES(gen_random_uuid(),'+79991234567','Тест','7707083893','UMO 5',1)"),/permission denied/);
 const id=crypto.randomUUID();assert.deepEqual((await call({id})).rows[0].result,{ok:true});assert.deepEqual((await call({id})).rows[0].result,{ok:true});
 await assert.rejects(call({inn:'7707083894'}),/validation_failed/);await assert.rejects(call({website:'spam'}),/validation_failed/);await assert.rejects(call({quantity:0}),/validation_failed/);await assert.rejects(call({name:'<script>'}),/validation_failed/);await assert.rejects(call({inn:null}),/validation_failed/);
 assert.deepEqual((await call({inn:'500100732259',phone:'+79991230000'})).rows[0].result,{ok:true});
 for(let i=0;i<9;i++)await call();await assert.rejects(call(),/rate_limit/);
 await identity(2);assert.equal((await db.query('SELECT * FROM public.exhibition_requests')).rows.length,0);assert.equal((await db.query('SELECT public.is_exhibition_owner() AS ok')).rows[0].ok,false);
 await identity(3);assert.equal((await db.query('SELECT * FROM public.exhibition_requests')).rows.length,0);
 await identity(1);const rows=(await db.query('SELECT * FROM public.exhibition_requests')).rows;assert.equal(rows.length,11);assert.equal(rows.filter(r=>r.id===id).length,1);assert.equal(rows.find(r=>r.id===id).quantity,3);
 await assert.rejects(db.query('DELETE FROM public.exhibition_requests'),/permission denied/);
 await assert.rejects(db.query("UPDATE public.exhibition_requests SET model='changed'"),/permission denied/);
});
test('client validation matches required fields',()=>{assert.equal(validate({name:'Иван',phone:'8 (999) 123-45-67',inn:'7707083893',model:'UMO 5',quantity:'2'}).ok,true);assert.equal(validate({}).ok,false);});
test.after(async()=>{await db.close();});

