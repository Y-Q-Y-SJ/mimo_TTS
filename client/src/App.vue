<template>
  <div class="app-container">
    <header class="app-header">
      <h1 @click="$router.push('/')">Book TTS</h1>
      <span class="subtitle">书籍转语音</span>
    </header>
    <main class="app-main">
      <router-view />
    </main>
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f5f7fa;
  min-height: 100vh;
}

.app-container {
  max-width: 960px;
  margin: 0 auto;
  padding: 20px;
}

.app-header {
  text-align: center;
  padding: 20px 0 30px;
}

.app-header h1 {
  font-size: 28px;
  color: #303133;
  margin-bottom: 4px;
  cursor: pointer;
}

.app-header h1:hover {
  color: #409eff;
}

.app-header .subtitle {
  color: #909399;
  font-size: 14px;
}

.app-main {
  background: #fff;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}
</style>
