require('dotenv').config();
const { pool } = require('../db');
const data = require('./data');

// 초기 데이터 입력. 여러 번 실행해도 안전합니다 (이미 있는 행은 건너뜀).
async function seed() {
  const client = await pool.connect();
  let failed = false;
  try {
    await client.query('BEGIN');

    // 캐릭터
    for (const [i, a] of data.avatars.entries()) {
      await client.query(
        `INSERT INTO avatars (code, name, emoji, color, sort_order) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, emoji = EXCLUDED.emoji,
           color = EXCLUDED.color, sort_order = EXCLUDED.sort_order`,
        [a.code, a.name, a.emoji, a.color, i]
      );
    }

    // 취향 카테고리 + 태그
    const categoryIds = {};
    const tagIds = {}; // `${categoryCode}:${tagName}` → id
    for (const [i, c] of data.categories.entries()) {
      const { rows } = await client.query(
        `INSERT INTO taste_categories (code, name, icon, sort_order) VALUES ($1, $2, $3, $4)
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, icon = EXCLUDED.icon, sort_order = EXCLUDED.sort_order
         RETURNING id`,
        [c.code, c.name, c.icon, i]
      );
      categoryIds[c.code] = rows[0].id;
      for (const [j, tag] of c.tags.entries()) {
        const t = await client.query(
          `INSERT INTO taste_tags (category_id, name, sort_order) VALUES ($1, $2, $3)
           ON CONFLICT (category_id, name) DO UPDATE SET sort_order = EXCLUDED.sort_order
           RETURNING id`,
          [rows[0].id, tag, j]
        );
        tagIds[`${c.code}:${tag}`] = t.rows[0].id;
      }
    }

    // 라운지 + 라운지 채팅방 + 대표 태그
    for (const [i, l] of data.lounges.entries()) {
      const { rows } = await client.query(
        `INSERT INTO lounges (name, description, category_id, icon, sort_order) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, icon = EXCLUDED.icon, sort_order = EXCLUDED.sort_order
         RETURNING id`,
        [l.name, l.description, categoryIds[l.category], l.icon, i]
      );
      const loungeId = rows[0].id;
      await client.query(
        `INSERT INTO chat_rooms (type, lounge_id) VALUES ('lounge', $1) ON CONFLICT (lounge_id) DO NOTHING`,
        [loungeId]
      );
      for (const tag of l.tags) {
        const tagId = tagIds[`${l.category}:${tag}`];
        if (!tagId) throw new Error(`라운지 "${l.name}"의 태그 "${tag}"가 ${l.category} 카테고리에 없습니다`);
        await client.query(
          `INSERT INTO lounge_tags (lounge_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [loungeId, tagId]
        );
      }
    }

    // 오늘의 질문
    for (const [i, q] of data.questions.entries()) {
      await client.query(
        `INSERT INTO questions (content, category_id, sort_order) VALUES ($1, $2, $3)
         ON CONFLICT (content) DO UPDATE SET sort_order = EXCLUDED.sort_order`,
        [q.content, q.category ? categoryIds[q.category] : null, i]
      );
    }

    await client.query('COMMIT');

    const count = async (t) => (await client.query(`SELECT COUNT(*)::int AS n FROM ${t}`)).rows[0].n;
    console.log('Seed complete:', {
      avatars: await count('avatars'),
      taste_categories: await count('taste_categories'),
      taste_tags: await count('taste_tags'),
      lounges: await count('lounges'),
      chat_rooms: await count('chat_rooms'),
      questions: await count('questions'),
    });
  } catch (err) {
    failed = true;
    await client.query('ROLLBACK');
    console.error('Seed failed:', err.message);
  } finally {
    client.release();
    await pool.end();
    if (failed) process.exit(1);
  }
}

seed();
