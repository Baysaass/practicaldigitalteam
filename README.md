# Гүйцэтгэлийн самбар (guitsetgel-web)

IT хэлтсийн ажлын гүйцэтгэлийн хяналт, үнэлгээний вэб. Jira-аас task-уудыг **өдөр бүр автоматаар** татаж Postgres-д хадгална. Хоёр хуудастай:

- **Хяналтын самбар** — авсан/хийсэн task, гүйцэтгэлийн хувь, хугацаандаа, SPI, CPI, хоцорсон task, өдөр тутмын график, зэрэглэлийн тархалт, ажилтан тус бүрийн дэлгэрэнгүй
- **Гүйцэтгэлийн үнэлгээ** — онооны карт, удирдлагын чанарын үнэлгээ (улирал бүрээр DB-д хадгална), үзүүлэлтийн жин, Excel (CSV) татах

Технологи: Next.js 16 (App Router, TypeScript), Tailwind CSS 4, shadcn/ui, Drizzle ORM + Postgres, Vercel Cron.

## Local дээр ажиллуулах

```bash
npm install
npm run db:seed-demo   # туршилтын өгөгдөл (заавал биш)
npm run dev            # http://localhost:3000
```

`DATABASE_URL` тохируулаагүй бол `.data/pglite` дотор embedded Postgres (PGlite) автоматаар үүсч, migration хийгдэнэ. Нэвтрэх нууц үг local дээр шаардлагагүй.

Жинхэнэ Jira-тай турших бол `.env.example`-г `.env.local` болгон хуулж бөглөөд, дээд талын **«Jira-аас татах»** товчийг дарна.

## Vercel дээр байрлуулах

1. **Repo.** Энэ хавтсыг тусдаа GitHub repo болгож push хийнэ.
2. **Database.** Vercel → Storage (Marketplace) → **Neon Postgres** (эсвэл Supabase) нэмэхэд `DATABASE_URL` автоматаар тохирно.
3. **Migration** (нэг удаа, дараа нь schema өөрчлөгдөх бүрт):
   ```bash
   DATABASE_URL="postgres://…" npm run db:migrate
   ```
4. **Environment Variables** (Vercel → Project → Settings): `.env.example`-д байгаа бүгдийг бөглөнө. Заавал:
   `DATABASE_URL`, `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, `JIRA_JQL`, `DASHBOARD_USER`, `DASHBOARD_PASSWORD`, `CRON_SECRET` (урт санамсаргүй тэмдэгт мөр, жишээ нь `openssl rand -hex 32`).
5. **Deploy.** Deploy хийсний дараа самбарт нэвтэрч **«Jira-аас татах»** дарж эхний өгөгдлөө авна.

### Өдөр бүрийн автомат татах

`vercel.json` дотор Vercel Cron тохируулсан: **өдөр бүр 06:00 (Улаанбаатар) = 22:00 UTC** `/api/cron/jira-sync`-ийг дуудна. Vercel `Authorization: Bearer $CRON_SECRET` толгой илгээдэг тул өөр хэн ч дуудаж чадахгүй.

- Эхний удаа сүүлийн `JIRA_INITIAL_DAYS` (120) хоногийн task-ийг, дараа нь зөвхөн сүүлийн амжилттай татахаас хойш шинэчлэгдсэнийг (1 өдрийн давхцалтай) татна.
- Ажилтанд оноогдсон огноо, ажил эхэлсэн огноо, дахин нээгдсэн тоог changelog-оос тооцно.
- Нэг task хэд хэдэн sprint дамжсан бол бүгдэд нь тооцогдоно (`issue_sprints`).
- Татсан түүх `sync_runs` хүснэгтэд, сүүлийн төлөв navbar-д харагдана.

### Jira талбарын ID олох

Story Points болон Sprint талбарын ID байгууллага бүрт өөр байж болно:

```
GET https://company.atlassian.net/rest/api/3/field
```

Хариунаас `"name": "Story Points"` (эсвэл "Story point estimate") болон `"name": "Sprint"`-ийн `id`-г `JIRA_STORY_POINTS_FIELD`, `JIRA_SPRINT_FIELD`-д тавина.

## Бүтэц

```
src/
  app/
    page.tsx                  Хяналтын самбар
    evaluation/page.tsx       Гүйцэтгэлийн үнэлгээ
    actions.ts                Server actions: Jira татах, үнэлгээ/жин хадгалах
    api/cron/jira-sync/       Vercel Cron endpoint
  db/schema.ts                Хүснэгтүүд (sprints, issues, issue_sprints, manager_ratings, settings, sync_runs)
  lib/
    jira.ts                   Jira REST client (Cloud v3 / Server v2), changelog задлах
    sync.ts                   DB рүү upsert, incremental sync
    metrics.ts                Үзүүлэлт, оноо, зэрэглэлийн тооцоо
    data.ts                   Хуудсуудын өгөгдөл
  proxy.ts                    Basic Auth (cron-оос бусад бүх хуудас)
drizzle/                      SQL migration-ууд
scripts/seed-demo.ts          Туршилтын өгөгдөл
```

## Schema өөрчлөх

```bash
# src/db/schema.ts-г засаад
npm run db:generate   # drizzle/ дотор шинэ migration
npm run db:migrate    # DATABASE_URL-тай database-д хэрэгжүүлэх
```
