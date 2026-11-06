Feature: A shift in the döner shop

  Scenario: Handing a finished döner over the pass earns points
    Given the scenario "ready-classic"
    Then the score is 0
    When player 1 presses "e"
    Then the score is more than 30
    And no ticket is waiting

  Scenario: Walking with the keyboard moves the cook
    Given the scenario "shift"
    When player 1 holds "d" for 500 ms
    Then cook 1 has moved right

  Scenario: The shift ends with a summary
    Given the scenario "last-seconds"
    When 11 seconds pass
    Then the end-of-shift card shows 175 points

  Scenario: Space makes cook 1 dash
    Given the scenario "shift"
    When player 1 holds "d" for 150 ms while pressing "Space"
    Then cook 1 has moved right

  Scenario: Holding Q with the extinguisher puts the spit fire out
    Given the scenario "kitchen-fire"
    When player 1 holds "q" for 1600 ms
    Then the spit is not burning

  Scenario: Two bots run the shop on their own
    Given a shift with 0 players and 2 bots
    Then the controls show 2 bots
    When 40 seconds pass
    Then the score is more than 0
