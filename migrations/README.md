# Datenbank-Migrationen

Die Migrationen sind für PostgreSQL bei Render vorgesehen.

Vor `001_initial.sql` muss die Extension `pgcrypto` aktiviert werden:

```sql
create extension if not exists pgcrypto;
```

Danach kann die Migration ausgeführt werden. Die Zugangsdaten gehören ausschließlich in Render unter Environment Variables und niemals in GitHub.
