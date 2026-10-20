import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ThinkCode 컨테이너에서는 tc-dev 가 WORKSPACE_ID 를 주입한다 (base·포트 5173 고정).
// 로컬에서 그냥 띄울 때는 루트('/') + 실행 환경이 준 PORT 를 따른다.
const workspaceId = process.env.WORKSPACE_ID

export default defineConfig({
  base: workspaceId ? `/preview/${workspaceId}` : '/',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
    port: workspaceId ? 5173 : Number(process.env.PORT) || undefined,
  },
})
