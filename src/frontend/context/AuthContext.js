import { createContext, useContext } from 'react';

// 회원·Guest 공통 인증 상태
// actor: { type: 'member' | 'guest', id } / token / expiresAt(Guest)
// 구현: #4(회원 인증), #5(Guest 세션) — docs/system_design.md §3
export const AuthContext = createContext({
  actor: null,
  token: null,
  expiresAt: null,
});

export const useAuth = () => useContext(AuthContext);
