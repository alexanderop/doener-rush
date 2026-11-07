Feature: The level campaign

  Scenario: A star on the first level opens the second
    Given a fresh campaign where "Der Imbiss" is locked
    When I play level "erster-tag" and end the shift with 150 points
    Then the end-of-shift card says "Neuer Rekord!"
    And the end-of-shift card says "Freigeschaltet: Der Imbiss"
    When I go back to the home page
    Then "Der Imbiss" can be picked
    And "Erster Tag" shows a record of 150

  Scenario: The next level button plays the level it opened
    Given a fresh campaign where "Der Imbiss" is locked
    When I play level "erster-tag" and end the shift with 150 points
    And I press "Nächstes Level"
    Then the shift runs in level "imbiss"
