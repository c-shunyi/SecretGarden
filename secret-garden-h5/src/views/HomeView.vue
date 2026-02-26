<script setup>
import { RouterLink } from 'vue-router'
</script>

<template>
  <main class="home-page">
    <section class="welcome-card">
      <h1>欢迎使用 Secret Garden</h1>
      <p>主页内容正在建设中。</p>
    </section>

    <section class="tools">
      <RouterLink to="/bills" class="tool-card">
        <div class="tool-main">
          <h2>记账</h2>
          <p>记录收入与支出，按月查看账单。</p>
        </div>
        <span class="arrow">进入</span>
      </RouterLink>
    </section>
  </main>
</template>

<style scoped>
.home-page {
  min-height: 100dvh;
  padding: 80px 16px 24px;
  background:
    radial-gradient(90% 70% at 10% 10%, rgba(194, 247, 220, 0.5), transparent 60%),
    radial-gradient(90% 70% at 90% 90%, rgba(218, 232, 255, 0.5), transparent 60%),
    #f7fbf4;
}

.welcome-card {
  max-width: 780px;
  margin: 0 auto;
  border-radius: 16px;
  padding: 24px 18px;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 10px 20px rgba(48, 78, 49, 0.08);
}

.welcome-card h1 {
  margin: 0;
  font-size: 24px;
  color: #204727;
}

.welcome-card p {
  margin: 10px 0 0;
  color: #4b6550;
}

.tools {
  max-width: 780px;
  margin: 12px auto 0;
}

.tool-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  border-radius: 16px;
  padding: 16px;
  background: linear-gradient(130deg, #ffffff 0%, #eefcf2 100%);
  border: 1px solid #d6e9da;
  text-decoration: none;
}

.tool-main h2 {
  margin: 0;
  color: #1f4b28;
  font-size: 20px;
}

.tool-main p {
  margin: 8px 0 0;
  color: #4f6553;
}

.arrow {
  flex: 0 0 auto;
  height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  background: #dff3e3;
  color: #2b6735;
  display: inline-grid;
  place-items: center;
  font-size: 13px;
}
</style>
