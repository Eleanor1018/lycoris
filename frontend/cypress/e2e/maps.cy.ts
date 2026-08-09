describe('Maps', () => {
    beforeEach(() => {
        cy.intercept('GET', '/api/me', {
            statusCode: 200,
            body: { data: null },
        })
        cy.intercept('GET', '/api/markers/viewport*', {
            statusCode: 200,
            body: [],
        })
    })

    it('renders nearby button in disabled state by default', () => {
        cy.visit('/maps')
        cy.contains('Nearby accessible restrooms').should('exist').and('be.disabled')
        cy.contains('button', 'Filter places').click()
        cy.contains('Legend').should('be.visible')
        cy.contains('label', 'Nursing Room').should('be.visible')
        cy.contains('Conversion therapy').should('not.exist')

        cy.get('button[aria-label="Open map settings"]').click()
        cy.contains('Nearby category')
            .parent()
            .within(() => {
                cy.contains('button', 'nursing rooms').should('be.visible')
            })
        cy.contains('Conversion therapy').should('not.exist')
    })

    it('enables nearby button after geolocation resolves', () => {
        cy.visit('/maps', {
            onBeforeLoad(win) {
                Object.defineProperty(win.navigator, 'geolocation', {
                    configurable: true,
                    value: {
                        watchPosition(success: (position: GeolocationPosition) => void) {
                            success({
                                coords: {
                                    latitude: 41.8781,
                                    longitude: -87.6298,
                                    accuracy: 10,
                                    altitude: null,
                                    altitudeAccuracy: null,
                                    heading: null,
                                    speed: null,
                                    toJSON: () => ({}),
                                },
                                timestamp: Date.now(),
                                toJSON: () => ({}),
                            } as GeolocationPosition)
                            return 1
                        },
                        clearWatch() {
                            // no-op for tests
                        },
                    },
                })
            },
        })

        cy.contains('Nearby accessible restrooms')
            .should('exist')
            .and('not.be.disabled')
    })
})
