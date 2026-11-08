Feature: The level campaign

  Scenario: Every kitchen can be picked on a fresh campaign
    Given a fresh campaign
    Then "Erster Tag" can be picked
    And "Der Imbiss" can be picked
    And "Backstube" can be picked

  Scenario: A shift keeps its record
    Given a fresh campaign
    When I play level "erster-tag" and end the shift with 150 points
    Then the end-of-shift card says "Neuer Rekord!"
    When I go back to the home page
    Then "Erster Tag" shows a record of 150

  Scenario: The next level button plays the next kitchen
    Given a fresh campaign
    When I play level "erster-tag" and end the shift with 150 points
    And I press "Nächstes Level"
    Then the shift runs in level "imbiss"

  Scenario: After the Großküche comes the Backstube, where customers order pastries
    Given a fresh campaign
    When I play level "grosskueche" and end the shift with 150 points
    And I press "Nächstes Level"
    Then customers order "Franzbrötchen, Mohnbrötchen, Brezel"
