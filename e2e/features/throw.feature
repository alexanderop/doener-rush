Feature: Throwing ingredients across the kitchen

  Scenario: F throws the lettuce to cook 2, and ' throws it back
    Given the scenario "catch"
    Then cook 1 holds a "lettuce"
    When player 1 presses "f"
    Then cook 2 holds a "lettuce"
    And cook 1 holds nothing
    When player 2 presses "'"
    Then cook 1 holds a "lettuce"
    And cook 2 holds nothing
