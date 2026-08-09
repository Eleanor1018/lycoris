describe('Maps legend menu on mobile', () => {
    beforeEach(() => {
        cy.viewport(390, 844)
        cy.intercept('GET', '/api/me', {
            statusCode: 200,
            body: { data: null },
        })
        cy.intercept('GET', '/api/markers/viewport*', {
            statusCode: 200,
            body: [],
        })
    })

    it('closes legend menu after tapping map area', () => {
        cy.visit('/maps')

        cy.contains('button', 'Filter places').click()
        cy.contains('Legend').should('be.visible')

        cy.get('.leaflet-container').click('center')

        cy.contains('Legend').should('not.exist')
    })
})
