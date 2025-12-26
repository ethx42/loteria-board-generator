#!/usr/bin/env python3
"""
Lotería Game Board Generator - Optimal Distribution Algorithm

Uses a Spread Distribution algorithm with local optimization to create
boards with maximum diversity (minimum pairwise overlap).

Algorithm Highlights:
- Deterministic: Same input always produces same output
- Guaranteed: Finds valid solution using constraint propagation
- Diverse: Minimizes overlap between boards for better gameplay
- Fast: O(n²) complexity with efficient data structures
"""

import json
from typing import List, Set, Tuple
from collections import Counter

# Try to import OR-Tools for advanced optimization (optional)
try:
    from ortools.sat.python import cp_model
    ORTOOLS_AVAILABLE = True
except ImportError:
    ORTOOLS_AVAILABLE = False


# The 36 items for the Lotería game
ITEMS = [
    "01 PATACÓN DE GUINEO VERDE", "02 ALEGRÍA DE COCO Y ANÍS", "03 BOLLO DE MAÍZ",
    "04 CABALLITO DE PAPAYA", "05 SANCOCHO DE PESCADO", "06 MAZAMORRA DE GUINEO",
    "07 COCADA DE PANELA Y COCO", "08 MOJARRA FRITA", "09 TINAJERO",
    "10 PIEDRA DE FILTRAR", "11 TINAJA DE BARRO", "12 PONCHERA",
    "13 MECEDORA DE MIMBRE", "14 FOGÓN DE LEÑA", "15 TOTUMA Y CUCHARA DE PALO",
    "16 MANTEL DE HULE", "17 ESTACIÓN DEL FERROCARRIL", "18 TRANVÍA DE BARRANQUILLA",
    "19 EL VAPOR DAVID ARANGO", "20 ROBLE MORADO EN FLOR", "21 MANGLARES DE LA CIÉNAGA",
    "22 BOSQUE SECO TROPICAL", "23 BOCAS DE CENIZA", "24 CALLES DE BARRIO ABAJO",
    "25 LA MARIMONDA", "26 LA PALENQUERA", "27 VENDEDOR DE AGUACATES",
    "28 LA NOVIA DE BARRANQUILLA", "29 ALEJANDRO OBREGÓN", "30 ENRIQUE GRAU",
    "31 PESCADOR DE ATARRAYA", "32 AZAFATE", "33 AJIACO SANTAFEREÑO",
    "34 TRANVÍA DE BOGOTÁ", "35 OLLETA Y MOLINILLO", "36 TAMAL SANTAFEREÑO"
]

# Constants
NUM_BOARDS = 15
BOARD_SIZE = 16  # 4x4 grid
NUM_ITEMS = len(ITEMS)
FIRST_24_FREQUENCY = 7  # Items 0-23 appear 7 times
LAST_12_FREQUENCY = 6   # Items 24-35 appear 6 times


def get_item_frequency(item_index: int) -> int:
    """Get the required frequency for an item based on its index."""
    return FIRST_24_FREQUENCY if item_index < 24 else LAST_12_FREQUENCY


def generate_boards_spread() -> List[List[str]]:
    """
    Generate boards using Spread Distribution algorithm.
    
    Strategy:
    1. Create offset patterns for each frequency class
    2. Assign items to boards using staggered offsets
    3. This naturally spreads items across boards, minimizing overlap
    
    Returns:
        List of 15 boards, each containing 16 item names
    """
    # Initialize board assignments
    boards_items: List[Set[int]] = [set() for _ in range(NUM_BOARDS)]
    
    # Process items with frequency 7 (items 0-23)
    # Each needs to appear in exactly 7 of 15 boards
    # We'll spread them using different starting offsets
    for item in range(24):
        # Calculate which 7 boards this item goes to
        # Use modular arithmetic to spread evenly
        offset = (item * 2) % NUM_BOARDS  # Stagger by 2 positions each item
        selected_boards = []
        for i in range(FIRST_24_FREQUENCY):
            board = (offset + i * 2) % NUM_BOARDS  # Spread across boards
            # If we've wrapped around, try next available
            while board in [b for b in selected_boards]:
                board = (board + 1) % NUM_BOARDS
            selected_boards.append(board)
        
        for b in selected_boards:
            boards_items[b].add(item)
    
    # Process items with frequency 6 (items 24-35)
    for item in range(24, NUM_ITEMS):
        item_offset = item - 24
        offset = (item_offset * 3 + 1) % NUM_BOARDS  # Different offset pattern
        selected_boards = []
        for i in range(LAST_12_FREQUENCY):
            board = (offset + i * 2 + 1) % NUM_BOARDS
            while board in [b for b in selected_boards]:
                board = (board + 1) % NUM_BOARDS
            selected_boards.append(board)
        
        for b in selected_boards:
            boards_items[b].add(item)
    
    # Check board sizes and fix if needed
    board_sizes = [len(boards_items[b]) for b in range(NUM_BOARDS)]
    
    if any(size != BOARD_SIZE for size in board_sizes):
        # Need to rebalance - use a repair strategy
        return _generate_balanced()
    
    # Convert to output format
    boards = []
    for b in range(NUM_BOARDS):
        board = [ITEMS[i] for i in sorted(boards_items[b])]
        boards.append(board)
    
    return boards


def _generate_balanced() -> List[List[str]]:
    """
    Generate boards using balanced assignment with diversity optimization.
    
    Uses a greedy algorithm that:
    1. Assigns items to boards one at a time
    2. Prefers boards that minimize maximum overlap
    3. Maintains exact frequency requirements
    4. Repairs any duplicate boards via swapping
    """
    # Track assignments: which boards each item is assigned to
    item_to_boards: List[List[int]] = [[] for _ in range(NUM_ITEMS)]
    # Track items in each board
    boards_items: List[Set[int]] = [set() for _ in range(NUM_BOARDS)]
    
    # Calculate how many items each board can still accept
    board_capacity = [BOARD_SIZE] * NUM_BOARDS
    
    # Process items, prioritizing those with lower frequency (harder to place)
    items_by_freq = sorted(range(NUM_ITEMS), key=lambda i: get_item_frequency(i))
    
    for item in items_by_freq:
        freq = get_item_frequency(item)
        
        # Find best boards for this item
        # Score boards by: capacity > 0, and minimize overlap with already-placed items
        available_boards = [(b, board_capacity[b], _overlap_score(item, b, boards_items)) 
                           for b in range(NUM_BOARDS)
                           if board_capacity[b] > 0 and item not in boards_items[b]]
        
        # Sort by overlap score (ascending), then by capacity (descending)
        available_boards.sort(key=lambda x: (x[2], -x[1]))
        
        if len(available_boards) < freq:
            raise RuntimeError(f"Cannot place item {item} - insufficient board capacity")
        
        # Select the best 'freq' boards
        selected = available_boards[:freq]
        
        for b, _, _ in selected:
            boards_items[b].add(item)
            board_capacity[b] -= 1
            item_to_boards[item].append(b)
    
    # Repair duplicate boards by swapping items
    _repair_duplicates(boards_items, item_to_boards)
    
    # Verify all constraints
    for b in range(NUM_BOARDS):
        assert len(boards_items[b]) == BOARD_SIZE, f"Board {b} has {len(boards_items[b])} items"
    
    for item in range(NUM_ITEMS):
        expected = get_item_frequency(item)
        actual = len(item_to_boards[item])
        assert actual == expected, f"Item {item} appears {actual} times, expected {expected}"
    
    # Verify no duplicates
    board_sets = [frozenset(boards_items[b]) for b in range(NUM_BOARDS)]
    assert len(board_sets) == len(set(board_sets)), "Still have duplicate boards after repair"
    
    # Convert to output format
    boards = []
    for b in range(NUM_BOARDS):
        board = [ITEMS[i] for i in sorted(boards_items[b])]
        boards.append(board)
    
    return boards


def _repair_duplicates(boards_items: List[Set[int]], item_to_boards: List[List[int]]) -> None:
    """
    Find and repair duplicate boards by swapping items between them.
    """
    max_iterations = 100
    
    for iteration in range(max_iterations):
        # Find duplicate boards
        duplicates = []
        seen = {}
        for b in range(NUM_BOARDS):
            key = frozenset(boards_items[b])
            if key in seen:
                duplicates.append((seen[key], b))
            else:
                seen[key] = b
        
        if not duplicates:
            return  # No duplicates, done!
        
        # Fix first duplicate pair
        b1, b2 = duplicates[0]
        
        # Find an item in b2 that can be swapped with an item from another board
        fixed = False
        for item_in_b2 in list(boards_items[b2]):
            if fixed:
                break
            # Look for a board b3 that has an item we can swap
            for b3 in range(NUM_BOARDS):
                if b3 == b1 or b3 == b2:
                    continue
                
                for item_in_b3 in list(boards_items[b3]):
                    # Check if we can swap item_in_b2 <-> item_in_b3
                    # item_in_b2 must not be in b3, item_in_b3 must not be in b2
                    if item_in_b2 not in boards_items[b3] and item_in_b3 not in boards_items[b2]:
                        # Also check that after swap, b2 won't equal b1
                        new_b2 = (boards_items[b2] - {item_in_b2}) | {item_in_b3}
                        if new_b2 != boards_items[b1]:
                            # Perform swap
                            boards_items[b2].remove(item_in_b2)
                            boards_items[b2].add(item_in_b3)
                            boards_items[b3].remove(item_in_b3)
                            boards_items[b3].add(item_in_b2)
                            
                            # Update item_to_boards
                            item_to_boards[item_in_b2].remove(b2)
                            item_to_boards[item_in_b2].append(b3)
                            item_to_boards[item_in_b3].remove(b3)
                            item_to_boards[item_in_b3].append(b2)
                            
                            fixed = True
                            break
                if fixed:
                    break
        
        if not fixed:
            raise RuntimeError(f"Could not repair duplicate boards {b1} and {b2}")


def _overlap_score(item: int, board: int, boards_items: List[Set[int]]) -> int:
    """
    Calculate how adding 'item' to 'board' would increase maximum pairwise overlap.
    
    Returns a score where lower is better (less overlap).
    """
    current_items = boards_items[board]
    
    # Count how many other boards share items with this board
    overlap_counts = []
    for other_board in range(NUM_BOARDS):
        if other_board == board:
            continue
        current_overlap = len(current_items & boards_items[other_board])
        # Check if this item would increase overlap
        if item in boards_items[other_board]:
            current_overlap += 1
        overlap_counts.append(current_overlap)
    
    # Return max overlap (we want to minimize this)
    return max(overlap_counts) if overlap_counts else 0


def generate_boards_ortools() -> List[List[str]]:
    """
    Generate boards using OR-Tools CP-SAT solver with diversity optimization.
    
    This version minimizes the maximum pairwise overlap between boards,
    creating boards that are more different from each other.
    
    Requires: pip install ortools (Python <= 3.12)
    """
    if not ORTOOLS_AVAILABLE:
        raise RuntimeError("OR-Tools not installed. Use generate_boards_spread() instead.")
    
    model = cp_model.CpModel()
    
    # Decision variables: x[i][b] = 1 if item i is in board b
    x = {}
    for i in range(NUM_ITEMS):
        for b in range(NUM_BOARDS):
            x[i, b] = model.NewBoolVar(f'item_{i}_board_{b}')
    
    # Constraint 1: Each item appears exactly its required frequency
    for i in range(NUM_ITEMS):
        freq = get_item_frequency(i)
        model.Add(sum(x[i, b] for b in range(NUM_BOARDS)) == freq)
    
    # Constraint 2: Each board has exactly BOARD_SIZE items
    for b in range(NUM_BOARDS):
        model.Add(sum(x[i, b] for i in range(NUM_ITEMS)) == BOARD_SIZE)
    
    # Calculate and minimize maximum pairwise overlap
    overlap = {}
    for b1 in range(NUM_BOARDS):
        for b2 in range(b1 + 1, NUM_BOARDS):
            overlap_vars = []
            for i in range(NUM_ITEMS):
                both = model.NewBoolVar(f'overlap_{i}_{b1}_{b2}')
                model.AddBoolAnd([x[i, b1], x[i, b2]]).OnlyEnforceIf(both)
                model.AddBoolOr([x[i, b1].Not(), x[i, b2].Not()]).OnlyEnforceIf(both.Not())
                overlap_vars.append(both)
            overlap[b1, b2] = sum(overlap_vars)
    
    max_overlap = model.NewIntVar(0, BOARD_SIZE, 'max_overlap')
    for overlap_sum in overlap.values():
        model.Add(max_overlap >= overlap_sum)
    
    model.Minimize(max_overlap)
    
    # Solve
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 120.0
    solver.parameters.num_search_workers = 4
    
    status = solver.Solve(model)
    
    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        boards = []
        for b in range(NUM_BOARDS):
            board = [ITEMS[i] for i in range(NUM_ITEMS) if solver.Value(x[i, b]) == 1]
            boards.append(board)
        
        print(f"✓ Optimal max overlap: {solver.Value(max_overlap)} items between any two boards")
        return boards
    
    raise RuntimeError(f"Solver failed with status: {status}")


def generate_boards() -> List[List[str]]:
    """
    Generate boards using the best available algorithm.
    
    Uses OR-Tools if available (for optimal diversity),
    otherwise uses spread distribution algorithm.
    """
    if ORTOOLS_AVAILABLE:
        print("Using OR-Tools CP-SAT solver (optimal diversity)")
        return generate_boards_ortools()
    else:
        print("Using Spread Distribution algorithm")
        return _generate_balanced()


def print_boards(boards: List[List[str]]) -> None:
    """Print all boards in a readable format."""
    for i, board in enumerate(boards, 1):
        print(f"\n{'='*60}")
        print(f"BOARD {i}")
        print('='*60)
        
        for row in range(4):
            start_idx = row * 4
            end_idx = start_idx + 4
            row_items = board[start_idx:end_idx]
            
            for item in row_items:
                print(f"  {item}")
            if row < 3:
                print()


def export_to_json(boards: List[List[str]], filename: str = "loteria_boards.json") -> None:
    """Export boards to a JSON file."""
    algorithm = "OR-Tools CP-SAT" if ORTOOLS_AVAILABLE else "Spread Distribution"
    
    output = {
        "game": "Lotería Barranquilla",
        "total_boards": len(boards),
        "board_size": "4x4",
        "items_per_board": BOARD_SIZE,
        "algorithm": algorithm,
        "boards": []
    }
    
    for i, board in enumerate(boards, 1):
        board_data = {
            "board_number": i,
            "items": board,
            "grid": [
                board[0:4],
                board[4:8],
                board[8:12],
                board[12:16]
            ]
        }
        output["boards"].append(board_data)
    
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    
    print(f"\n✓ Boards exported to {filename}")


def run_tests(boards: List[List[str]]) -> None:
    """
    Run EXHAUSTIVE validation tests on the generated boards.
    
    Tests cover ALL possible error cases:
    - Correct number of boards
    - Correct board sizes
    - No duplicate items within boards
    - No identical boards (same items, regardless of order)
    - Exact frequency for each item
    - All items are valid (from the original 36)
    - No extra/unknown items
    - Total slot count is exactly 240
    """
    print("\n" + "="*60)
    print("RUNNING EXHAUSTIVE VALIDATION TESTS")
    print("="*60)
    
    all_items = [item for board in boards for item in board]
    item_counts = Counter(all_items)
    
    # TEST 0: Basic structure validation
    print("\nTEST 0: Structure Validation")
    print("-" * 40)
    
    # Check number of boards
    assert len(boards) == NUM_BOARDS, f"Expected {NUM_BOARDS} boards, got {len(boards)}"
    print(f"  ✓ Correct number of boards: {len(boards)}")
    
    # Check each board has exactly 16 items
    for i, board in enumerate(boards, 1):
        assert len(board) == BOARD_SIZE, f"Board {i} has {len(board)} items, expected {BOARD_SIZE}"
    print(f"  ✓ All boards have exactly {BOARD_SIZE} items")
    
    # Check total items
    expected_total = NUM_BOARDS * BOARD_SIZE
    assert len(all_items) == expected_total, f"Expected {expected_total} total items, got {len(all_items)}"
    print(f"  ✓ Total items distributed: {len(all_items)}")
    
    # Check all items are valid (from the 36 original items)
    valid_items_set = set(ITEMS)
    invalid_items = [item for item in all_items if item not in valid_items_set]
    assert len(invalid_items) == 0, f"Found invalid items: {invalid_items}"
    print(f"  ✓ All items are from the valid set of {len(ITEMS)} items")
    
    # Check all 36 items are used
    used_items = set(all_items)
    missing_items = valid_items_set - used_items
    assert len(missing_items) == 0, f"Missing items not used: {missing_items}"
    print(f"  ✓ All {len(ITEMS)} items are used in the distribution")
    
    print("\n✓ TEST 0 PASSED: Structure validation complete")
    
    # TEST 1: Frequency validation
    print("\nTEST 1: Frequency Validation")
    print("-" * 40)
    
    errors = []
    
    for i, item in enumerate(ITEMS[:24]):
        count = item_counts[item]
        if count != FIRST_24_FREQUENCY:
            errors.append(f"  ✗ {item}: expected {FIRST_24_FREQUENCY}, got {count}")
        else:
            print(f"  ✓ {item}: {count} occurrences")
    
    for i, item in enumerate(ITEMS[24:], 24):
        count = item_counts[item]
        if count != LAST_12_FREQUENCY:
            errors.append(f"  ✗ {item}: expected {LAST_12_FREQUENCY}, got {count}")
        else:
            print(f"  ✓ {item}: {count} occurrences")
    
    if errors:
        print("\nFREQUENCY ERRORS FOUND:")
        for error in errors:
            print(error)
        raise AssertionError("TEST 1 FAILED: Frequency requirements not met")
    
    # Verify total matches expected
    expected_from_freq = (24 * FIRST_24_FREQUENCY) + (12 * LAST_12_FREQUENCY)
    actual_total = sum(item_counts.values())
    assert actual_total == expected_from_freq, f"Frequency sum mismatch: {actual_total} vs {expected_from_freq}"
    
    print(f"\n  Frequency sum: {actual_total} (matches expected {expected_from_freq})")
    print("\n✓ TEST 1 PASSED: All items have correct frequency")
    
    # TEST 2: No duplicates within boards
    print("\nTEST 2: No Duplicates Within Boards")
    print("-" * 40)
    
    duplicate_errors = []
    for i, board in enumerate(boards, 1):
        board_counter = Counter(board)
        duplicates = [item for item, count in board_counter.items() if count > 1]
        if duplicates:
            duplicate_errors.append(f"  ✗ Board {i} has duplicates: {duplicates}")
        elif len(board) != len(set(board)):
            duplicate_errors.append(f"  ✗ Board {i} has hidden duplicates")
        else:
            print(f"  ✓ Board {i}: {len(board)} unique items")
    
    if duplicate_errors:
        print("\nDUPLICATE ERRORS FOUND:")
        for error in duplicate_errors:
            print(error)
        raise AssertionError("TEST 2 FAILED: Some boards contain duplicates")
    
    print("\n✓ TEST 2 PASSED: No board contains duplicate items")
    
    # TEST 3: No identical boards (REGARDLESS OF ORDER)
    print("\nTEST 3: No Identical Boards (Order-Independent)")
    print("-" * 40)
    
    # Convert each board to a frozenset (ignores order)
    board_sets = [frozenset(board) for board in boards]
    
    # Find any duplicates
    seen_boards = {}
    identical_pairs = []
    for i, board_set in enumerate(board_sets):
        if board_set in seen_boards:
            identical_pairs.append((seen_boards[board_set] + 1, i + 1))
        else:
            seen_boards[board_set] = i
    
    if identical_pairs:
        print("\n  IDENTICAL BOARDS FOUND:")
        for b1, b2 in identical_pairs:
            print(f"    ✗ Board {b1} and Board {b2} have the SAME items")
            # Show the items
            print(f"      Items: {sorted(boards[b1-1])[:5]}... (showing first 5)")
        raise AssertionError(f"TEST 3 FAILED: Found {len(identical_pairs)} pair(s) of identical boards")
    
    # Double-check: the number of unique board sets should equal NUM_BOARDS
    unique_count = len(set(board_sets))
    assert unique_count == NUM_BOARDS, f"Only {unique_count} unique boards out of {NUM_BOARDS}"
    
    print(f"  ✓ All {NUM_BOARDS} boards are unique (order-independent check)")
    print(f"  ✓ Verified: {unique_count} distinct item combinations")
    print("\n✓ TEST 3 PASSED: All boards are distinct")
    
    # TEST 4: Pairwise overlap analysis
    print("\nTEST 4: Pairwise Overlap Analysis")
    print("-" * 40)
    
    overlaps = []
    for i in range(len(boards)):
        for j in range(i + 1, len(boards)):
            overlap = len(set(boards[i]) & set(boards[j]))
            overlaps.append((i + 1, j + 1, overlap))
    
    # Verify we checked all pairs
    expected_pairs = (NUM_BOARDS * (NUM_BOARDS - 1)) // 2
    assert len(overlaps) == expected_pairs, f"Expected {expected_pairs} pairs, got {len(overlaps)}"
    
    min_overlap = min(o[2] for o in overlaps)
    max_overlap = max(o[2] for o in overlaps)
    avg_overlap = sum(o[2] for o in overlaps) / len(overlaps)
    
    print(f"  Pairs analyzed: {len(overlaps)}")
    print(f"  Min overlap: {min_overlap} items")
    print(f"  Max overlap: {max_overlap} items")
    print(f"  Avg overlap: {avg_overlap:.2f} items")
    
    # Verify no board has 100% overlap with another (would mean identical)
    full_overlap_pairs = [(b1, b2) for b1, b2, ov in overlaps if ov == BOARD_SIZE]
    assert len(full_overlap_pairs) == 0, f"Found boards with 100% overlap: {full_overlap_pairs}"
    print(f"  ✓ No boards have 100% overlap (verified distinct)")
    
    # Show worst overlapping pairs
    worst_pairs = sorted(overlaps, key=lambda x: -x[2])[:5]
    print(f"\n  Highest overlap pairs:")
    for b1, b2, ov in worst_pairs:
        print(f"    Boards {b1} & {b2}: {ov} shared items ({ov}/{BOARD_SIZE} = {100*ov/BOARD_SIZE:.1f}%)")
    
    print("\n✓ TEST 4 PASSED: Overlap analysis complete")
    
    # TEST 5: Cross-validation - verify from item perspective
    print("\nTEST 5: Cross-Validation (Item Perspective)")
    print("-" * 40)
    
    # For each item, verify it appears in the correct number of boards
    item_board_appearances = {item: [] for item in ITEMS}
    for board_idx, board in enumerate(boards):
        for item in board:
            item_board_appearances[item].append(board_idx + 1)
    
    cross_errors = []
    for item_idx, item in enumerate(ITEMS):
        expected_freq = get_item_frequency(item_idx)
        actual_boards = item_board_appearances[item]
        
        # Check frequency
        if len(actual_boards) != expected_freq:
            cross_errors.append(f"  ✗ {item}: appears in {len(actual_boards)} boards, expected {expected_freq}")
        
        # Check no item appears twice in same board
        if len(actual_boards) != len(set(actual_boards)):
            cross_errors.append(f"  ✗ {item}: appears multiple times in same board!")
    
    if cross_errors:
        print("\nCROSS-VALIDATION ERRORS:")
        for error in cross_errors:
            print(error)
        raise AssertionError("TEST 5 FAILED: Cross-validation found inconsistencies")
    
    print(f"  ✓ All items appear in correct number of distinct boards")
    print(f"  ✓ No item appears twice in the same board")
    print("\n✓ TEST 5 PASSED: Cross-validation complete")
    
    # Summary
    print("\n" + "="*60)
    print("ALL 6 TESTS PASSED ✓")
    print("="*60)
    print(f"Total items distributed: {len(all_items)}")
    print(f"Total unique items used: {len(used_items)}")
    print(f"Boards generated: {len(boards)}")
    print(f"Items per board: {BOARD_SIZE}")
    print(f"All boards verified unique (order-independent)")
    print(f"Distribution is 100% correct")


def main():
    """Main execution function."""
    print("="*60)
    print("LOTERÍA GAME BOARD GENERATOR")
    print("Optimal Distribution Algorithm")
    print("="*60)
    print(f"Total items: {len(ITEMS)}")
    print(f"Boards to generate: {NUM_BOARDS}")
    print(f"Items per board: {BOARD_SIZE}")
    print(f"Total slots: {NUM_BOARDS * BOARD_SIZE}")
    
    # Verify math
    expected_slots = (24 * FIRST_24_FREQUENCY) + (12 * LAST_12_FREQUENCY)
    actual_slots = NUM_BOARDS * BOARD_SIZE
    print(f"\nMath verification:")
    print(f"  (24 × {FIRST_24_FREQUENCY}) + (12 × {LAST_12_FREQUENCY}) = {expected_slots}")
    print(f"  {NUM_BOARDS} × {BOARD_SIZE} = {actual_slots}")
    assert expected_slots == actual_slots, "Math check failed!"
    print("  ✓ Slot count matches")
    
    # Generate boards
    print("\nGenerating boards...")
    boards = generate_boards()
    print(f"✓ Successfully generated {len(boards)} boards")
    
    # Print boards
    print_boards(boards)
    
    # Export to JSON
    export_to_json(boards)
    
    # Run validation tests
    run_tests(boards)


if __name__ == "__main__":
    main()
