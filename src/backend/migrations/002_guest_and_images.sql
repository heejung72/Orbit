-- 002: 게스트 사용자 지원 + 취향 이미지 URL

-- users 테이블: 게스트 지원
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ADD COLUMN is_guest BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN guest_expires_at TIMESTAMP;
ALTER TABLE users ADD CONSTRAINT uq_email UNIQUE (email) DEFERRABLE;

-- taste_options 테이블: 이미지 URL 추가
ALTER TABLE taste_options ADD COLUMN image_url VARCHAR(500) DEFAULT '';

-- messages 테이블: 게스트 발신자 식별
ALTER TABLE messages ALTER COLUMN sender_id DROP NOT NULL;
ALTER TABLE messages ADD COLUMN guest_session_id VARCHAR(100);

-- 게스트 만료 인덱스
CREATE INDEX idx_users_guest_expires ON users(guest_expires_at) WHERE is_guest = true;

-- 시드: 취향 옵션 이미지 URL (Unsplash 기반 플레이스홀더)
UPDATE taste_options SET image_url = CASE name
  -- 음악
  WHEN '팝' THEN 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400'
  WHEN '힙합' THEN 'https://images.unsplash.com/photo-1571609803939-54f463cbddc0?w=400'
  WHEN 'R&B' THEN 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400'
  WHEN '클래식' THEN 'https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=400'
  WHEN '인디' THEN 'https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?w=400'
  WHEN '록' THEN 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=400'
  WHEN 'K-POP' THEN 'https://images.unsplash.com/photo-1514533212735-5df27d970db0?w=400'
  WHEN '재즈' THEN 'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=400'
  WHEN 'EDM' THEN 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400'
  -- 영화
  WHEN '액션' THEN 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400'
  WHEN '로맨스' THEN 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=400'
  WHEN '코미디' THEN 'https://images.unsplash.com/photo-1527224857830-43a7acc85260?w=400'
  WHEN '호러' THEN 'https://images.unsplash.com/photo-1509248961895-40b7e1d4ff9e?w=400'
  WHEN 'SF' THEN 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=400'
  WHEN '다큐멘터리' THEN 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=400'
  WHEN '애니메이션' THEN 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400'
  WHEN '스릴러' THEN 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400'
  -- 운동
  WHEN '러닝' THEN 'https://images.unsplash.com/photo-1461896836934-bd45ba7ab982?w=400'
  WHEN '헬스' THEN 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400'
  WHEN '등산' THEN 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=400'
  WHEN '축구' THEN 'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=400'
  WHEN '농구' THEN 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=400'
  WHEN '수영' THEN 'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=400'
  WHEN '요가' THEN 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400'
  WHEN '테니스' THEN 'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=400'
  WHEN '자전거' THEN 'https://images.unsplash.com/photo-1541625602330-2277a4c46182?w=400'
  -- 음식
  WHEN '한식' THEN 'https://images.unsplash.com/photo-1498654896293-37aacf113fd9?w=400'
  WHEN '일식' THEN 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=400'
  WHEN '중식' THEN 'https://images.unsplash.com/photo-1525755662778-989d0524087e?w=400'
  WHEN '양식' THEN 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400'
  WHEN '카페' THEN 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400'
  WHEN '비건' THEN 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400'
  WHEN '디저트' THEN 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=400'
  WHEN '길거리음식' THEN 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400'
  -- 여행
  WHEN '배낭여행' THEN 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=400'
  WHEN '호캉스' THEN 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400'
  WHEN '캠핑' THEN 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=400'
  WHEN '로드트립' THEN 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=400'
  WHEN '해외여행' THEN 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=400'
  WHEN '국내여행' THEN 'https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=400'
  WHEN '섬여행' THEN 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400'
  -- 게임
  WHEN 'RPG' THEN 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=400'
  WHEN 'FPS' THEN 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400'
  WHEN '모바일게임' THEN 'https://images.unsplash.com/photo-1556438064-2d7646166914?w=400'
  WHEN '보드게임' THEN 'https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?w=400'
  WHEN '닌텐도' THEN 'https://images.unsplash.com/photo-1578303512597-81e6cc155b3e?w=400'
  WHEN 'PC게임' THEN 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=400'
  -- 독서
  WHEN '소설' THEN 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400'
  WHEN '자기계발' THEN 'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?w=400'
  WHEN '에세이' THEN 'https://images.unsplash.com/photo-1474366521946-c3d4b507abf2?w=400'
  WHEN '만화' THEN 'https://images.unsplash.com/photo-1601850494422-3cf14624b0b3?w=400'
  WHEN '역사' THEN 'https://images.unsplash.com/photo-1461360370896-922624d12a74?w=400'
  WHEN '과학' THEN 'https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=400'
  -- 반려동물
  WHEN '강아지' THEN 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400'
  WHEN '고양이' THEN 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400'
  WHEN '물고기' THEN 'https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?w=400'
  WHEN '햄스터' THEN 'https://images.unsplash.com/photo-1425082661507-6af0db267089?w=400'
  WHEN '파충류' THEN 'https://images.unsplash.com/photo-1504450874802-0ba2bcd10b9a?w=400'
  ELSE ''
END;
