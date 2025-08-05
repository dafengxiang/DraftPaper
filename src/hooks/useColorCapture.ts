import { ref } from 'vue'

export function useColorCapture() {
  const isColorCapture = ref(false)

  const handleColorCapture = () => {
    isColorCapture.value = !isColorCapture.value
  }

  return {
    isColorCapture,
    handleColorCapture,
  }
}
