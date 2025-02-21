import { isTestSuiteActive } from "../../support/page_objects/projectConstants";
import { mainPage } from "../../support/page_objects/mainPage";
import { loginPage } from "../../support/page_objects/navigation";

let storedURL = "";

// 0: all enabled
// 1: field hide
// 2: field sort
// 3: field filter
// 4: default (address table): for view operation validation
// 5: default (country table): for update row/column validation
let viewURL = {};

export const genTest = (apiType, dbType) => {
  if (!isTestSuiteActive(apiType, dbType)) return;

  function verifyLtarCell(columnName, index, cellValue, options) {
    if (cellValue !== "")
      cy.get(`:nth-child(${index}) > [data-title="${columnName}"]`)
        .find(".chip")
        .eq(0)
        .contains(cellValue)
        .should("exist");

    mainPage
      .getCell(columnName, index)
      .click()
      .find(".nc-icon.nc-unlink-icon")
      .should(`${options.unlink ? "exist" : "not.exist"}`);
    mainPage
      .getCell(columnName, index)
      .click()
      .find(".nc-icon.nc-plus")
      .should(`${options.plus ? "exist" : "not.exist"}`);
    mainPage
      .getCell(columnName, index)
      .click()
      .find(".nc-icon.nc-arrow-expand")
      .should(`${options.expand ? "exist" : "not.exist"}`);
  }

  function actionLtarCell(columnName, index, button) {
    mainPage
      .getCell(columnName, index)
      .click()
      .find(`.nc-icon${button}`)
      .click({ force: true });
  }

  function verifyChildListCard(cardValue, options) {
    // reload button
    cy.getActiveModal(".nc-modal-child-list")
      .find(`[data-cy="nc-child-list-reload"]`)
      .should(`${options.reload ? "exist" : "not.exist"}`);

    // link-to button
    cy.getActiveModal(".nc-modal-child-list")
      .find(`[data-cy="nc-child-list-button-link-to"]`)
      .should(`${options.linkTo ? "exist" : "not.exist"}`);

    // child card
    //  - contents : should exist
    //  - link-to button : should not exist
    //  - delete button : should not exist
    if (cardValue !== "") {
      cy.getActiveModal(".nc-modal-child-list")
        .find(".ant-card")
        .contains(cardValue)
        .should("exist");
      cy.getActiveModal(".nc-modal-child-list")
        .find(".ant-card")
        .find(`[data-cy="nc-child-list-icon-unlink"]`)
        .should(`${options.unlink ? "exist" : "not.exist"}`);
      cy.getActiveModal(".nc-modal-child-list")
        .find(".ant-card")
        .find(`[data-cy="nc-child-list-icon-delete"]`)
        .should(`${options.delete ? "exist" : "not.exist"}`);
    }
  }

  const generateViewLink = (viewName) => {
    mainPage.shareView().click();

    cy.wait(1000);

    // wait, as URL initially will be /undefined
    cy.getActiveModal(".nc-modal-share-view")
      .find(".share-link-box")
      .contains("/nc/view/", { timeout: 10000 })
      .should("exist");

    // copy link text, visit URL
    cy.getActiveModal(".nc-modal-share-view")
      .find(".share-link-box")
      .contains("/nc/view/", { timeout: 10000 })
      .then(($obj) => {
        // cy.get("body").type("{esc}");
        cy.closeActiveModal(".nc-modal-share-view");
        viewURL[viewName] = $obj.text().trim();
      });
  };

  let clear;

  describe(`${apiType.toUpperCase()} api - GRID view (Share)`, () => {
    // Run once before test- create project (rest/graphql)
    //
    before(() => {
      cy.restoreLocalStorage();
      cy.openTableTab("Address", 25);

      clear = Cypress.LocalStorage.clear;
      Cypress.LocalStorage.clear = () => {};
    });

    beforeEach(() => {
      cy.restoreLocalStorage();
    });

    afterEach(() => {
      cy.saveLocalStorage();
    });

    after(() => {
      // close table
      // mainPage.deleteCreatedViews()
      cy.restoreLocalStorage();
      cy.closeTableTab("Address");
      cy.saveLocalStorage();

      Cypress.LocalStorage.clear = clear;
    });

    // Common routine to create/edit/delete GRID & GALLERY view
    // Input: viewType - 'grid'/'gallery'
    //
    const viewTest = (viewType) => {
      it(`Create ${viewType.toUpperCase()} view`, () => {
        // create a normal public view
        cy.get(`.nc-create-${viewType}-view`).click();
        cy.getActiveModal(".nc-modal-view-create")
          .find("button:contains(Submit)")
          .click();
        cy.toastWait("View created successfully");

        // store base URL- to re-visit and delete form view later
        cy.url().then((url) => {
          storedURL = url;
        });
      });

      it(`Share ${viewType.toUpperCase()} hide, sort, filter & verify`, () => {
        cy.intercept("/api/v1/db/meta/audits/comments/**").as(
          "waitForPageLoad"
        );

        cy.get(`.nc-view-item.nc-${viewType}-view-item`)
          .contains("Grid-1")
          .click();
        mainPage.hideField("Address2");
        mainPage.sortField("Address", "Z → A");
        mainPage.filterField("Address", "is like", "Ab");
        generateViewLink("combined");
        cy.log(viewURL["combined"]);

        cy.wait(["@waitForPageLoad"]);
        // kludge: additional wait to ensure page load is completed
        cy.wait(2000);
      });

      it(`Share GRID view : ensure we have only one link even if shared multiple times`, () => {
        // generate view link multiple times
        generateViewLink("combined");
        generateViewLink("combined");

        // verify if only one link exists in table
        mainPage.shareViewList().click();

        cy.get('th:contains("View Link")').should("exist");

        cy.get('th:contains("View Link")')
          .parent()
          .parent()
          .next()
          .find("tr")
          .its("length")
          .should("eq", 1)
          .then(() => {
            cy.get("button.ant-modal-close:visible").click();
          });

        cy.signOut();
      });

      it(`Share ${viewType.toUpperCase()} view : Visit URL, Verify title`, () => {
        // visit public view
        cy.visit(viewURL["combined"], {
          baseUrl: null,
        });
        cy.wait(5000);

        // wait for page rendering to complete
        cy.get(".nc-grid-row").should("have.length", 18);

        // verify title
        cy.get(".nc-shared-view-title").contains("Grid-1").should("exist");
      });

      it(`Share ${viewType.toUpperCase()} view : verify fields hidden/open`, () => {
        // verify column headers
        cy.get('[data-title="Address"]').should("exist");
        cy.get('[data-title="Address2"]').should("not.exist");
        cy.get('[data-title="District"]').should("exist");
      });

      it(`Share ${viewType.toUpperCase()} view : verify fields sort/ filter`, () => {
        // country column content verification before sort
        mainPage
          .getCell("Address", 1)
          .contains("669 Firozabad Loop")
          .should("exist");
        mainPage
          .getCell("Address", 2)
          .contains("48 Maracabo Place")
          .should("exist");
        mainPage
          .getCell("Address", 3)
          .contains("44 Najafabad Way")
          .should("exist");
      });

      it(`Share ${viewType.toUpperCase()} view : verify download CSV`, () => {
        mainPage.hideField("LastUpdate");
        const verifyCsv = (retrievedRecords) => {
          // expected output, statically configured
          let storedRecords = [
            `Address,District,PostalCode,Phone`,
            `669 Firozabad Loop,,92265,,[object Object],2,,Kanchrapara,`,
            `48 Maracabo Place,,1570,,[object Object],2,,Tafuna,`,
            `44 Najafabad Way,,61391,,[object Object],2,,Tambaram,`,
            `381 Kabul Way,,87272,,[object Object],1,,Pudukkottai,`,
          ];

          for (let i = 0; i < storedRecords.length; i++) {
            let strCol = storedRecords[i].split(",");
            let retCol = retrievedRecords[i].split(",");
            expect(strCol[0]).to.be.equal(retCol[0]);
            expect(strCol[2]).to.be.equal(retCol[2]);
            // expect(retrievedRecords[i]).to.be.equal(storedRecords[i])
          }
        };

        // download & verify
        mainPage.downloadAndVerifyCsvFromSharedView(
          `Address_exported_1.csv`,
          verifyCsv
        );
        mainPage.unhideField("LastUpdate");
      });

      it(`Share ${viewType.toUpperCase()} view : Disable sort`, () => {
        // remove sort and validate
        mainPage.clearSort();
        mainPage
          .getCell("Address", 1)
          .contains("669 Firozabad Loop")
          .should("exist");
      });

      it(`Share ${viewType.toUpperCase()} view : Enable sort`, () => {
        // Sort menu operations (Country Column, Z->A)
        mainPage.sortField("Address", "A → Z");
        mainPage
          .getCell("Address", 1)
          .contains("1013 Tabuk Boulevard")
          .should("exist");
      });

      it(`Share ${viewType.toUpperCase()} view : Create Filter`, () => {
        // add filter & validate
        mainPage.filterField("Address", "is like", "drive");
        // wait for page rendering to complete
        cy.get(".nc-grid-row").should("have.length", 3);
        mainPage
          .getCell("Address", 1)
          .contains("1294 Firozabad Drive")
          .should("exist");
      });

      it(`Share ${viewType.toUpperCase()} view : verify download CSV after local filter`, () => {
        mainPage.hideField("LastUpdate");
        const verifyCsv = (retrievedRecords) => {
          // expected output, statically configured
          let storedRecords = [
            `Address,District,PostalCode,Phone,Location,Customer List,Staff List,City,Staff List`,
            `1294 Firozabad Drive,,70618,,2,,Pingxiang,,`,
            `1661 Abha Drive,,14400,,1,,Pudukkottai,,`,
          ];

          // for (let i = 0; i < storedRecords.length; i++) {
          //     expect(retrievedRecords[i]).to.be.equal(storedRecords[i])
          // }

          for (let i = 0; i < storedRecords.length; i++) {
            let strCol = storedRecords[i].split(",");
            let retCol = retrievedRecords[i].split(",");
            expect(strCol[0]).to.be.equal(retCol[0]);
            expect(strCol[2]).to.be.equal(retCol[2]);
          }
        };
        mainPage.downloadAndVerifyCsvFromSharedView(
          `Address_exported_1.csv`,
          verifyCsv
        );
        mainPage.unhideField("LastUpdate");
      });

      it(`Share ${viewType.toUpperCase()} view : Delete Filter`, () => {
        // Remove sort and Validate
        mainPage.filterReset();
        mainPage.clearSort();

        mainPage
          .getCell("Address", 1)
          .contains("669 Firozabad Loop")
          .should("exist");
      });

      it(`Share GRID view : Virtual column validation > has many`, () => {
        // verify column headers
        cy.get('[data-title="Customer List"]').should("exist");
        cy.get('[data-title="Staff List"]').should("exist");
        cy.get('[data-title="City"]').should("exist");
        cy.get('[data-title="Staff List1"]').should("exist");

        // has many field validation
        verifyLtarCell("Customer List", 1, "1", {
          unlink: false,
          plus: false,
          expand: true,
        });
        actionLtarCell("Customer List", 1, ".nc-arrow-expand");
        verifyChildListCard("1", {
          reload: true,
          linkTo: false,
          unlink: false,
          delete: false,
        });
        cy.closeActiveModal(".nc-modal-child-list");
      });

      it(`Share GRID view : Virtual column validation > belongs to`, () => {
        // belongs to field validation
        verifyLtarCell("City", 1, "al-Ayn", {
          unlink: false,
          plus: false,
          expand: false,
        });
      });

      it(`Share GRID view : Virtual column validation > many to many`, () => {
        // many to many field verification
        verifyLtarCell("Staff List1", 1, "", {
          unlink: false,
          plus: false,
          expand: true,
        });
        actionLtarCell("Staff List1", 1, ".nc-arrow-expand");
        verifyChildListCard("", {
          reload: true,
          linkTo: false,
          unlink: false,
          delete: false,
        });
      });

      it(`Delete ${viewType.toUpperCase()} view`, () => {
        // go back to base page
        loginPage.loginAndOpenProject(apiType, dbType);
        cy.openTableTab("Address", 25);

        // number of view entries should be 2 before we delete
        cy.get(".nc-view-item").its("length").should("eq", 2);

        cy.get(".nc-view-delete-icon").eq(0).click({ force: true });
        cy.getActiveModal(".nc-modal-view-delete")
          .find(".ant-btn-dangerous")
          .click();
        cy.toastWait("View deleted successfully");

        // confirm if the number of veiw entries is reduced by 1
        cy.get(".nc-view-item").its("length").should("eq", 1);
      });
    };

    // below scenario's will be invoked twice, once for rest & then for graphql
    viewTest("grid");
  });

  describe(`${apiType.toUpperCase()} api - Grid view/ row-column update verification`, () => {
    before(() => {
      cy.restoreLocalStorage();

      // Address table has belongs to, has many & many-to-many
      cy.openTableTab("Country", 25);

      // store base URL- to re-visit and delete form view later
      cy.url().then((url) => {
        storedURL = url;
        generateViewLink("rowColUpdate");
      });
    });

    beforeEach(() => {
      cy.restoreLocalStorage();
    });

    afterEach(() => {
      cy.saveLocalStorage();
    });

    after(() => {
      cy.restoreLocalStorage();
      cy.closeTableTab("Country");
      cy.saveLocalStorage();
    });

    it(`Generate default Shared GRID view URL`, () => {
      // add row
      mainPage.addNewRowExpand("Country");
      cy.get(".nc-expand-col-Country")
        .find(".nc-cell > input")
        .should("exist")
        .first()
        .clear({ force: true })
        .type("a");
      cy.getActiveDrawer(".nc-drawer-expanded-form")
        .find("button")
        .contains("Save row")
        .should("exist")
        .click();
      cy.toastWait("updated successfully");
      cy.getActiveDrawer(".nc-drawer-expanded-form")
        .find("button")
        .contains("Cancel")
        .should("exist")
        .click();
      // add column
      mainPage.addColumn("dummy", "Country");

      cy.signOut();

      // visit public view
      cy.log(viewURL["rowColUpdate"]);
      cy.visit(viewURL["rowColUpdate"], {
        baseUrl: null,
      });
      cy.wait(5000);

      // wait for public view page to load!
      // wait for page rendering to complete
      cy.get(".nc-grid-row").should("have.length", 25);
    });

    it(`Share GRID view : new row visible`, () => {
      // verify row
      // cy.get(`.v-pagination > li:contains('5') button`).click();
      cy.get(
        `.nc-pagination > .ant-pagination-item.ant-pagination-item-5`
      ).click();
      // wait for page rendering to complete
      cy.get(".nc-grid-row").should("have.length", 10);
      mainPage.getCell("Country", 10).contains("a").should("exist");
    });

    it(`Share GRID view : new column visible`, () => {
      // verify column headers
      cy.get('[data-title="dummy"]').should("exist");
    });

    it(`Clean up`, () => {
      loginPage.loginAndOpenProject(apiType, dbType);
      cy.openTableTab("Country", 25);

      // delete row
      mainPage.getPagination(5).click();
      // kludge: flicker on load
      cy.wait(3000);

      // wait for page rendering to complete
      cy.get(".nc-grid-row").should("have.length", 10);
      mainPage.getCell("Country", 10).rightclick();
      cy.getActiveMenu(".nc-dropdown-grid-context-menu")
        .find('.ant-dropdown-menu-item:contains("Delete Row")')
        .first()
        .click();

      // delete column
      mainPage.deleteColumn("dummy");
      mainPage.deleteCreatedViews();
    });
  });
};
