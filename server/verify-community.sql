-- Disposable database acceptance test. All changes roll back, including the
-- synthetic identity. No emails, auth credentials or real customer rows are used.
begin;
do $$
declare u uuid:=gen_random_uuid(); a jsonb; blocked boolean:=false;
begin
 insert into auth.users(id) values(u);
 a:=public.vault_account(u);
 if (a->>'remaining')::integer<>50 or (a->>'pro')::boolean then raise exception 'Initial Community allowance failed'; end if;
 perform public.vault_reserve(u,'unsaved');
 perform public.vault_settle(u,'unsaved','released');
 a:=public.vault_account(u);
 if (a->>'remaining')::integer<>50 then raise exception 'Failed-run release failed'; end if;
 for i in 1..50 loop
  perform public.vault_reserve(u,'test-'||i);
  perform public.vault_settle(u,'test-'||i,'saved');
  perform public.vault_settle(u,'test-'||i,'saved');
 end loop;
 a:=public.vault_account(u);
 if (a->>'used')::integer<>50 or (a->>'remaining')::integer<>0 then raise exception 'Save counting/idempotence failed'; end if;
 begin
  perform public.vault_reserve(u,'overflow');
 exception when raise_exception then
  if position('50 free runs' in sqlerrm)=0 then raise; end if;
  blocked:=true;
 end;
 if not blocked then raise exception 'The 51st Community run was allowed'; end if;
end $$;
rollback;
select 'PASS: 50 lifetime saves, repeated acknowledgments, unsaved release and 51st-run rejection; test identity rolled back' as result;
