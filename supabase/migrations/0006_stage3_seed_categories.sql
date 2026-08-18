-- Глобальные категории по умолчанию (family_id = null, видны всем семьям).
-- on conflict — по expression-индексу categories_unique_idx (см. 0005).
insert into categories (family_id, name, kind, icon) values
  (null, 'Продукты',        'expense', '🛒'),
  (null, 'Кафе и рестораны','expense', '🍽'),
  (null, 'Транспорт',       'expense', '🚗'),
  (null, 'Жильё и коммуналка','expense', '🏠'),
  (null, 'Здоровье',        'expense', '💊'),
  (null, 'Одежда',          'expense', '👕'),
  (null, 'Развлечения',     'expense', '🎬'),
  (null, 'Дети',            'expense', '🧒'),
  (null, 'Подписки',        'expense', '💳'),
  (null, 'Прочее',          'expense', '📦'),
  (null, 'Зарплата',        'income',  '💰'),
  (null, 'Подработка',      'income',  '💼'),
  (null, 'Прочий доход',    'income',  '➕')
on conflict (coalesce(family_id, '00000000-0000-0000-0000-000000000000'::uuid), name, kind)
do nothing;
