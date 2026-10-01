-- O Preview atual está protegido por Vercel Authentication.
-- Enquanto o acesso de automação não estiver liberado, manter o cron pausado
-- evita uma chamada 401 por minuto. A infraestrutura fica pronta para ser
-- reativada assim que o Preview aceitar a chamada autenticada do worker.

do $$
declare
  worker_job_id bigint;
begin
  select jobid
    into worker_job_id
  from cron.job
  where jobname = 'tela-social-publication-worker'
  limit 1;

  if worker_job_id is not null then
    perform cron.alter_job(worker_job_id, active := false);
  end if;
end
$$;
