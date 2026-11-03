// My Orbit(회원 프로필·탈퇴) E2E 테스트 (#17)
// 실행: 서버(npm run dev)를 켠 상태에서 `npm run test:users` (DB 시드 필요: npm run db:setup)
require('dotenv').config();
const crypto = require('crypto');
const assert = require('assert');
const jwt = require('jsonwebtoken');
const { io } = require('socket.io-client');
const db = require('../db');

const B = process.env.API_URL || `http://localhost:${process.env.PORT || 3000}/api`;
const SOCKET_URL = B.replace(/\/api$/, '');
const call = async (method, path, body, headers = {}) => {
  const r = await fetch(B + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { s: r.status, j: await r.json().catch(() => ({})) };
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let passed = 0;
const check = async (name, fn) => {
  await fn();
  passed += 1;
  console.log('PASS ', name);
};

(async () => {
  const sockets = [];
  try {
    const id = crypto.randomBytes(4).toString('hex');
    const member = async (name) => {
      const email = `users_${name}_${id}@orbit.test`;
      const r = await call('POST', '/auth/register', { email, password: 'pw123456', nickname: name });
      return { email, token: r.j.token, userId: jwt.decode(r.j.token).userId, H: { Authorization: 'Bearer ' + r.j.token } };
    };
    const [A, P] = [await member('궤도주인'), await member('대화상대')];

    await check('내 프로필: 이메일·닉네임·캐릭터, 실제 id·예전 tastes 필드 없음', async () => {
      const r = await call('GET', '/users/me', undefined, A.H);
      assert.strictEqual(r.s, 200);
      assert.deepStrictEqual(Object.keys(r.j).sort(), ['avatar_emoji', 'avatar_id', 'created_at', 'email', 'nickname']);
      assert.strictEqual(r.j.email, A.email);
      assert.ok(!JSON.stringify(r.j).includes(A.userId));
    });

    await check('프로필 수정: 잘못된 값 400 (닉네임 길이·형식, 캐릭터 범위·없는 캐릭터, 빈 요청)', async () => {
      for (const body of [{}, { nickname: 'a' }, { nickname: 'a'.repeat(13) }, { nickname: '   ' }, { nickname: 123 }, { nickname: null },
        { avatar_id: 0 }, { avatar_id: -1 }, { avatar_id: 'x' }, { avatar_id: 1.5 }, { avatar_id: 2 ** 31 }, { avatar_id: 999999 }]) {
        assert.strictEqual((await call('PATCH', '/users/me', body, A.H)).s, 400, JSON.stringify(body));
      }
    });

    await check('프로필 수정: 닉네임 trim·캐릭터 변경, 보낸 항목만 바뀜, /auth/me에도 반영', async () => {
      const r = await call('PATCH', '/users/me', { nickname: '  새벽별  ' }, A.H);
      assert.deepStrictEqual([r.s, r.j.nickname, r.j.avatar_id], [200, '새벽별', 1]);
      const r2 = await call('PATCH', '/users/me', { avatar_id: 3 }, A.H);
      assert.deepStrictEqual([r2.j.nickname, r2.j.avatar_id], ['새벽별', 3]);
      assert.ok(r2.j.avatar_emoji && !('id' in r2.j));
      const me = (await call('GET', '/auth/me', undefined, A.H)).j;
      assert.deepStrictEqual([me.nickname, me.avatar_id], ['새벽별', 3]);
    });

    await check('예전 PUT /users/me 제거', async () => {
      assert.strictEqual((await call('PUT', '/users/me', { nickname: '바꾸기' }, A.H)).s, 404);
    });

    await check('Guest는 프로필 조회·수정·탈퇴 403 MEMBER_ONLY', async () => {
      const g = (await call('POST', '/guest/session')).j;
      const G = { 'X-Guest-Token': g.guestToken };
      for (const [m, body] of [['GET'], ['PATCH', { nickname: '바꾸기' }], ['DELETE', { password: 'x' }]]) {
        assert.strictEqual((await call(m, '/users/me', body, G)).j.code, 'MEMBER_ONLY', m);
      }
    });

    // 탈퇴 대상 D: P와 1:1 방에서 대화한 뒤 탈퇴
    const D = await member('떠날회원');
    const room = (await db.query(`INSERT INTO chat_rooms (type) VALUES ('direct') RETURNING id`)).rows[0].id;
    await db.query(
      `INSERT INTO chat_members (room_id, user_id, display_name, avatar_id) VALUES ($1, $2, '떠날 별', 1), ($1, $3, '남을 별', 2)`,
      [room, D.userId, P.userId]
    );
    await db.query(`INSERT INTO messages (room_id, sender_id, content) VALUES ($1, $2, '안녕, 나 곧 떠나')`, [room, D.userId]);

    await check('탈퇴: 비밀번호 없음 400, 틀리면 401 WRONG_PASSWORD이고 계정은 그대로', async () => {
      assert.strictEqual((await call('DELETE', '/users/me', {}, D.H)).s, 400);
      const wrong = await call('DELETE', '/users/me', { password: 'wrong-password' }, D.H);
      assert.deepStrictEqual([wrong.s, wrong.j.code], [401, 'WRONG_PASSWORD']);
      assert.strictEqual((await call('POST', '/auth/login', { email: D.email, password: 'pw123456' })).s, 200);
    });

    await check('탈퇴: 삭제·로그인 불가·기존 토큰 401, 상대와의 1:1 방 종료, 보낸 메시지는 "떠난 궤도"로 남음, 소켓 종료', async () => {
      const s = io(SOCKET_URL, { auth: { token: D.token }, transports: ['websocket'], reconnection: false, forceNew: true });
      sockets.push(s);
      await new Promise((r) => s.once('connect', r));
      const ok = await call('DELETE', '/users/me', { password: 'pw123456' }, D.H);
      assert.strictEqual(ok.s, 200);
      await sleep(300);
      assert.ok(s.disconnected);
      assert.strictEqual((await call('POST', '/auth/login', { email: D.email, password: 'pw123456' })).s, 401);
      assert.strictEqual((await call('GET', '/users/me', undefined, D.H)).s, 401);
      assert.ok((await db.query('SELECT closed_at FROM chat_rooms WHERE id = $1', [room])).rows[0].closed_at);
      const history = (await call('GET', `/chat/rooms/${room}/messages`, undefined, P.H)).j;
      assert.deepStrictEqual(history.map((m) => [m.content, m.sender_nickname, m.is_mine]), [['안녕, 나 곧 떠나', '떠난 궤도', false]]);
    });

    console.log(`\n${passed}개 통과`);
  } catch (err) {
    console.error('FAIL ', err.message);
    process.exitCode = 1;
  } finally {
    sockets.forEach((s) => s.close());
    await db.pool.end();
  }
})();
