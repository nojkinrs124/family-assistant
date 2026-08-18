insert into stores (name, slug) values
  ('Лента', 'lenta'),
  ('ВкусВилл', 'vkusvill')
on conflict (slug) do nothing;
