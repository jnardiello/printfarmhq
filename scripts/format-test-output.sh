#!/bin/bash

# Simple script to format pytest output for better readability
# Usage: pytest ... | ./scripts/format-test-output.sh

while IFS= read -r line; do
    # Skip coverage warnings
    if [[ "$line" =~ "CoverageWarning" ]] || [[ "$line" =~ "coverage._warn" ]]; then
        continue
    fi
    
    # Highlight test results
    if [[ "$line" =~ "PASSED" ]]; then
        echo -e "\033[32m$line\033[0m"  # Green for passed
    elif [[ "$line" =~ "FAILED" ]]; then
        echo -e "\033[31m$line\033[0m"  # Red for failed
    elif [[ "$line" =~ "SKIPPED" ]]; then
        echo -e "\033[33m$line\033[0m"  # Yellow for skipped
    elif [[ "$line" =~ "====" ]] || [[ "$line" =~ "----" ]]; then
        echo -e "\033[36m$line\033[0m"  # Cyan for headers
    else
        echo "$line"
    fi
done