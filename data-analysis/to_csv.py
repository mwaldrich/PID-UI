import json
import csv

# Helper function to determine if an interaction is successful
def is_successful(click):
    return 0.01 <= click["p"] <= 0.05

# Function to write data to a CSV file
def write_to_csv(data, filename):
    with open(filename, mode='w', newline='', encoding='utf-8') as file:
        writer = csv.writer(file)
        # Write the header
        writer.writerow(["type", "button", "successful", "changed", "group", "unitNumber"])
        # Write the data
        for click in data:
            writer.writerow([
                click["type"],
                click["button"],
                'True' if is_successful(click) else 'False',  # Use 'True' or 'False'
                click["changed"],
                click["group"],
                click["unitNumber"]
            ])

# Timestamp to split the data
cutoff_timestamp = 1702416251437

def main():
    # Read the original data
    with open('clicks.txt', 'r') as file:
        all_data = [json.loads(line) for line in file if line.strip()]

    # Track the last p value for each unit
    last_p_values = {}

    # Add a 'changed' field to each click based on p value changes
    for click in all_data:
        unit_number = click["unitNumber"]
        current_p = click["p"]
        changed = unit_number not in last_p_values or last_p_values[unit_number] != current_p
        click["changed"] = changed
        last_p_values[unit_number] = current_p

    # Split the data based on the cutoff timestamp
    initial_experiment_data = [click for click in all_data if click["datetime"] < cutoff_timestamp]
    counterbalance_data = [click for click in all_data if click["datetime"] >= cutoff_timestamp]

    # File paths for the CSV files
    initial_experiment_csv_file = 'initial_experiment.csv'
    counterbalance_csv_file = 'counterbalance.csv'

    # Write the data to CSV files
    write_to_csv(initial_experiment_data, initial_experiment_csv_file)
    write_to_csv(counterbalance_data, counterbalance_csv_file)

    print("CSV files with 'successful' as True/False created successfully.")

if __name__ == "__main__":
    main()

