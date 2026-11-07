"""Read the mailbox register with pandas and print a report: who to call, the money, the boxes.

Reading only: it never writes to the register, so it is safe to run while Calc has it open.
It sees the register as it was last saved (Ctrl+S first for the latest).

    python -m pip install pandas odfpy        # once
    python physical-mailbox/tools/calc/register-report.py [path/to/mailbox-register.ods] [--csv folder]

With --csv it also writes holders.csv, payments.csv and boxes.csv into that folder, for anything
else you want to do with them. Keep those files off GitHub too: they hold customer details.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[3] / 'scripts'))
import owner_guard  # noqa: E402,F401  stops a clone that is not set up by an owner
import argparse  # noqa: E402
import pandas as pd  # noqa: E402

HERE = Path(__file__).resolve().parent


def load(path):
    """Every tab we need as a DataFrame, with the empty template rows dropped."""
    read = lambda tab, **kw: pd.read_excel(path, engine='odf', sheet_name=tab, **kw)
    holders = read('Holders').dropna(subset=['Code'])
    payments = read('Payments').dropna(subset=['Code'])
    boxes = read('Boxes').dropna(subset=['Box #'])
    prices = read('Prices', nrows=3)
    for df, cols in ((holders, ['Start date', 'Paid through', 'Closed date']), (payments, ['Date'])):
        for c in cols:
            df[c] = pd.to_datetime(df[c], errors='coerce')
    return holders, payments, boxes, prices


def report(holders, payments, boxes, prices):
    open_ = holders[holders['Closed date'].isna()]
    print(f'Open customers: {len(open_)}   Boxes: {len(boxes)}   Free: {(boxes["Status"] == "Free").sum()}')

    print('\nTo call or remind')
    todo = open_[(open_['Status'].isin(['Overdue', 'Due soon'])) | (open_['ID check'] != 'OK')]
    if todo.empty:
        print('  nobody')
    for _, h in todo.sort_values('Paid through').iterrows():
        when = h['Paid through'].strftime('%b %d') if pd.notna(h['Paid through']) else '?'
        print(f'  {h["Code"]}  {h["Name"]:<24} box {h["Box #"]!s:<5} {h["Status"]:<9} paid to {when}  ID {h["ID check"]}  {h["Phone"]}')

    print('\nTaken by month ($)')
    if payments.empty:
        print('  no payments yet')
    else:
        by_month = payments.groupby(payments['Date'].dt.to_period('M'))['Amount taken ($)'].sum()
        for month, amount in by_month.items():
            print(f'  {month}  {amount:>9,.2f}')

    print('\nBoxes by size')
    rate = 'Monthly rate ($)' if 'Monthly rate ($)' in prices else 'Monthly price ($)'   # renamed in v1.92.7
    price = dict(zip(prices['Size'], prices[rate]))
    table = boxes.assign(taken=boxes['Status'] != 'Free').groupby('Size')['taken'].agg(boxes='count', taken='sum')
    table['free'] = table['boxes'] - table['taken']
    table['a month if full ($)'] = [n * price.get(s, 0) for s, n in table['boxes'].items()]
    print(table.to_string())


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument('path', nargs='?', default=str(HERE.parents[1] / 'mailbox-register.ods'))
    ap.add_argument('--csv', help='folder to write holders.csv, payments.csv and boxes.csv into')
    a = ap.parse_args()
    holders, payments, boxes, prices = load(a.path)
    report(holders, payments, boxes, prices)
    if a.csv:
        out = Path(a.csv); out.mkdir(parents=True, exist_ok=True)
        for name, df in (('holders', holders), ('payments', payments), ('boxes', boxes)):
            df.to_csv(out / f'{name}.csv', index=False)
        print(f'\nCSV files in {out}')


if __name__ == '__main__':
    main()
