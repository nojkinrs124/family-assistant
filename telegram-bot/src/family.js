import { supabase } from './supabaseClient.js';

/**
 * Находит профиль по telegram_id или создаёт новый.
 * Профиль без семьи — нормальное промежуточное состояние сразу после /start.
 */
export async function getOrCreateProfile({ telegramId, name, username }) {
  const { data: existing, error: selectErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('telegram_id', telegramId)
    .maybeSingle();

  if (selectErr) throw new Error(`profiles.select: ${selectErr.message}`);
  if (existing) return existing;

  const { data: created, error: insertErr } = await supabase
    .from('profiles')
    .insert({ telegram_id: telegramId, name, username })
    .select()
    .single();

  if (insertErr) throw new Error(`profiles.insert: ${insertErr.message}`);
  return created;
}

/** Семья, в которой состоит профиль (первая активная), или null. */
export async function getActiveFamily(profileId) {
  const { data, error } = await supabase
    .from('family_members')
    .select('family_id, role, families ( id, name )')
    .eq('user_id', profileId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`family_members.select: ${error.message}`);
  return data ? { id: data.family_id, name: data.families?.name, role: data.role } : null;
}

/** Создаёт новую семью и делает переданный профиль её owner'ом. */
export async function createFamilyWithOwner({ profileId, familyName }) {
  const { data: family, error: familyErr } = await supabase
    .from('families')
    .insert({ name: familyName })
    .select()
    .single();

  if (familyErr) throw new Error(`families.insert: ${familyErr.message}`);

  const { error: memberErr } = await supabase
    .from('family_members')
    .insert({ family_id: family.id, user_id: profileId, role: 'owner', status: 'active' });

  if (memberErr) throw new Error(`family_members.insert: ${memberErr.message}`);

  await writeAuditLog({
    familyId: family.id,
    actorId: profileId,
    action: 'family.created',
    entityType: 'family',
    entityId: family.id,
  });

  return family;
}

export async function writeAuditLog({ familyId, actorId, action, entityType, entityId, metadata = {} }) {
  const { error } = await supabase.from('audit_logs').insert({
    family_id: familyId ?? null,
    actor_id: actorId ?? null,
    action,
    entity_type: entityType ?? null,
    entity_id: entityId ?? null,
    metadata,
  });
  // Аудит-лог не должен ронять основной сценарий — только логируем ошибку.
  if (error) console.error(`audit_logs.insert failed: ${error.message}`);
}
