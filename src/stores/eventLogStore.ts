import { defineStore } from 'pinia'

interface LogEntry {
  id: number
  time: string
  text: string
}

interface State {
  entries: LogEntry[]
  nextId: number
}

export const useEventLogStore = defineStore('eventLog', {
  state: (): State => ({
    entries: [],
    nextId: 0,
  }),
  actions: {
    addEntry(text: string) {
      this.entries.push({
        id: this.nextId++,
        time: new Date().toLocaleTimeString(),
        text,
      })
    },
  },

  getters: {
    recentEntries: (state) => state.entries.slice(-10).reverse(),
  },
})
