import { createApp } from 'vue'
import Review from './views/Review.vue'

import './contentScript.css'

const app = createApp(Review)
app.mount('#app')
