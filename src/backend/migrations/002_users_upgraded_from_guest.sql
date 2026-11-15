-- #14 Guest → 회원 전환: 어느 Guest에서 옮겨 온 회원인지 (같은 Guest를 두 번 옮기지 않도록 UNIQUE)
-- Guest 세션 자체는 PG에 저장하지 않는다. 전환된 회원 행에만 원래 guestId(랜덤 UUID)를 남긴다
ALTER TABLE users ADD COLUMN upgraded_from_guest UUID UNIQUE;
