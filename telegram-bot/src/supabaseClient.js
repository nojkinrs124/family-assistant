import { createClient } from '@supabase/supabase-js';

/**
 * Service role key обходит RLS — поэтому этот клиент существует только
 * на бэкенде бота и никогда не попадает в Telegram-сообщения, логи или
 * клиентский код. Все проверки прав (кто есть в какой семье и что ему
 * можно) бот делает сам, на уровне запросов ниже — RLS здесь как
 * страховка на случай, если этот код когда-нибудь начнёт использовать
 * anon-ключ, а не как единственный барьер.
 */
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);
