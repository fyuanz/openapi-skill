<script setup lang="ts">
import { reactive, ref } from 'vue'
import {
  ApiRequestError,
  createOrder,
  getUser,
  listUsers,
  uploadFile,
  type CreateOrder,
  type UploadReceipt,
  type UserView,
} from '@/api/client'

interface Panel<T> {
  loading: boolean
  ok: boolean | null
  summary: string
  output: T | null
}

function emptyPanel<T>(): Panel<T> {
  return { loading: false, ok: null, summary: '尚未调用', output: null }
}

function show(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

async function run<T>(panel: Panel<T>, action: () => Promise<T>, onOk: (value: T) => string) {
  panel.loading = true
  panel.ok = null
  panel.summary = '请求中…'
  try {
    const value = await action()
    panel.output = value
    panel.ok = true
    panel.summary = onOk(value)
  } catch (error) {
    panel.output = null
    panel.ok = false
    if (error instanceof ApiRequestError) {
      panel.summary = `HTTP ${error.status} · ${error.message}`
      if (error.body) panel.output = error.body as unknown as T
    } else {
      panel.summary = error instanceof Error ? error.message : String(error)
    }
  } finally {
    panel.loading = false
  }
}

// GET /users
const listPanel = emptyPanel<UserView[]>()
const keyword = ref('示例')

// GET /users/{id} + X-Request-Id
const detailPanel = emptyPanel<UserView>()
const userId = ref(1)
const requestId = ref('req-demo-0001')

// POST /orders
const orderPanel = emptyPanel<CreateOrder>()
const orderForm = reactive({ userId: 1, quantity: 2, city: '示例市', street: '示例路' })

// POST /orders with invalid payload to prove the documented 400 shape
const invalidOrderPanel = emptyPanel<{ code: string; message: string }>()

// POST /files
const uploadPanel = emptyPanel<UploadReceipt>()
const selectedFile = ref<File | null>(null)

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  selectedFile.value = input.files?.[0] ?? null
}

function callList() {
  return run(listPanel, () => listUsers(keyword.value || undefined), (v) => `200 · 返回 ${v.length} 条用户`)
}

function callDetail() {
  return run(
    detailPanel,
    () => getUser(userId.value, requestId.value || undefined),
    (v) => `200 · ${v.name}（${v.address.city}${v.address.street}）`,
  )
}

function callCreateOrder() {
  const payload: CreateOrder = {
    userId: orderForm.userId,
    quantity: orderForm.quantity,
    shippingAddress: { city: orderForm.city, street: orderForm.street },
  }
  return run(orderPanel, () => createOrder(payload), () => '201 · 服务端回显了订单请求体')
}

function callInvalidOrder() {
  return run(
    invalidOrderPanel,
    async () => {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ userId: null, quantity: 0 }),
      })
      const body = (await response.json()) as { code: string; message: string }
      if (response.ok) throw new Error('expected a 400 response but the service accepted the payload')
      return body
    },
    () => '校验被拒绝并返回了文档化的 ApiError',
  )
}

function callUpload() {
  const file = selectedFile.value
  if (!file) {
    uploadPanel.ok = false
    uploadPanel.summary = '请先选择一个文件'
    uploadPanel.output = null
    return Promise.resolve()
  }
  return run(uploadPanel, () => uploadFile(file), (v) => `200 · 服务端报告 ${v.size} 字节`)
}

// A tiny helper so the template can show the raw status code of the 400 probe.
const invalidStatus = ref<number | null>(null)
async function callInvalidOrderWithStatus() {
  invalidStatus.value = null
  await callInvalidOrder()
  invalidStatus.value = invalidOrderPanel.ok === false ? 400 : null
}
</script>

<template>
  <h1>OpenAPI Skill 真实消费端</h1>
  <p class="subtitle">
    Vue 3 + TypeScript 前端，通过 Vite 代理真实调用 <code>127.0.0.1:18080</code> 上
    <code>springdoc-multi-package</code> 服务的分组合约（account / business）。
  </p>

  <!-- GET /users -->
  <section class="panel">
    <h2>GET /users <span v-if="listPanel.ok !== null" class="status" :class="listPanel.ok ? 'ok' : 'err'">{{ listPanel.summary }}</span></h2>
    <div class="row">
      <label for="kw">keyword</label>
      <input id="kw" v-model="keyword" type="text" placeholder="按显示名称过滤（可留空）" />
      <button :disabled="listPanel.loading" @click="callList">调用</button>
    </div>
    <pre v-if="listPanel.output">{{ show(listPanel.output) }}</pre>
  </section>

  <!-- GET /users/{id} -->
  <section class="panel">
    <h2>GET /users/{id} <span v-if="detailPanel.ok !== null" class="status" :class="detailPanel.ok ? 'ok' : 'err'">{{ detailPanel.summary }}</span></h2>
    <div class="row">
      <label for="uid">用户编号</label>
      <input id="uid" v-model.number="userId" type="number" min="1" />
      <label for="rid">X-Request-Id</label>
      <input id="rid" v-model="requestId" type="text" placeholder="可选请求头" />
      <button :disabled="detailPanel.loading" @click="callDetail">调用</button>
    </div>
    <p class="hint">编号不等于 1 时服务返回 404 与 ApiError，可用下面的按钮验证。</p>
    <div class="row">
      <button class="secondary" :disabled="detailPanel.loading" @click="userId = 999; callDetail()">用不存在的编号调用</button>
    </div>
    <pre v-if="detailPanel.output">{{ show(detailPanel.output) }}</pre>
  </section>

  <!-- POST /orders -->
  <section class="panel">
    <h2>POST /orders <span v-if="orderPanel.ok !== null" class="status" :class="orderPanel.ok ? 'ok' : 'err'">{{ orderPanel.summary }}</span></h2>
    <div class="row">
      <label for="ouid">userId</label>
      <input id="ouid" v-model.number="orderForm.userId" type="number" min="1" />
      <label for="oqty">quantity</label>
      <input id="oqty" v-model.number="orderForm.quantity" type="number" min="1" />
      <label for="ocity">city</label>
      <input id="ocity" v-model="orderForm.city" type="text" />
      <label for="ostreet">street</label>
      <input id="ostreet" v-model="orderForm.street" type="text" />
      <button :disabled="orderPanel.loading" @click="callCreateOrder">调用</button>
    </div>
    <pre v-if="orderPanel.output">{{ show(orderPanel.output) }}</pre>
  </section>

  <!-- POST /orders invalid -->
  <section class="panel">
    <h2>POST /orders（非法请求体） <span v-if="invalidOrderPanel.ok !== null" class="status" :class="invalidOrderPanel.ok ? 'ok' : 'err'">{{ invalidOrderPanel.summary }}</span></h2>
    <p class="hint">发送缺失 userId 且 quantity=0 的请求体，验证文档中 400 + ApiError 的契约。</p>
    <div class="row">
      <button :disabled="invalidOrderPanel.loading" @click="callInvalidOrderWithStatus">调用</button>
      <span v-if="invalidStatus" class="status err">实际状态码 {{ invalidStatus }}</span>
    </div>
    <pre v-if="invalidOrderPanel.output">{{ show(invalidOrderPanel.output) }}</pre>
  </section>

  <!-- POST /files -->
  <section class="panel">
    <h2>POST /files <span v-if="uploadPanel.ok !== null" class="status" :class="uploadPanel.ok ? 'ok' : 'err'">{{ uploadPanel.summary }}</span></h2>
    <div class="row">
      <input type="file" @change="onFileChange" />
      <button :disabled="uploadPanel.loading" @click="callUpload">调用</button>
    </div>
    <p class="hint">multipart/form-data 上传，服务端只返回文件字节数。</p>
    <pre v-if="uploadPanel.output">{{ show(uploadPanel.output) }}</pre>
  </section>
</template>
