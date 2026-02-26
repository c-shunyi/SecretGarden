<template>
  <main class="home-page">
    <section class="welcome-card">
      <h1>欢迎使用 Secret Garden</h1>
      <p>主页内容正在建设中。</p>
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
</style>
