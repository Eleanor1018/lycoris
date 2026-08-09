import { defineConfig } from 'cypress'

export default defineConfig({
    e2e: {
        baseUrl: process.env.CYPRESS_BASE_URL || 'http://127.0.0.1:5173/',
        specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
        supportFile: 'cypress/support/e2e.ts',
    },
    video: false,
    screenshotOnRunFailure: true,
})
