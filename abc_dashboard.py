from odoo import models, api
import datetime
import calendar


HIERARCHICAL_MODES = {
    'customer_group': {
        'group_field': 'srm.customer_group_name',
        'child_field': 'srm.customer_name',
    },
    'buyer_group': {
        'group_field': 'srm.buyer_group_name',
        'child_field': 'srm.buyer_name',
    },
    'country': {
        'group_field': 'srm.country_name',
        'child_field': 'srm.customer_name',
    },
}

FLAT_FIELD_MAP = {
    'customer':     'srm.customer_name',
    'buyer_name':   'srm.buyer_name',
    'sales_person': 'srm.sales_person_name',
    'sales_team':   'srm.sales_team',
    'item':         'srm.item',
}


class AbcDashboard(models.Model):
    _name = 'abc.dashboard'
    _description = 'ABC Sales Revenue Dashboard'

    @api.model
    def get_filter_options(self):
        current_year = datetime.date.today().year
        years = list(range(current_year - 5, current_year + 2))

        self.env.cr.execute("""
            SELECT DISTINCT rc.id, rc.name,
                CASE
                    WHEN rc.name ILIKE '%Zipper%' THEN 1
                    WHEN rc.name ILIKE '%Metal%'  THEN 2
                    ELSE 3
                END as sort_weight
            FROM res_company rc
            WHERE rc.name ILIKE '%Zipper%' OR rc.name ILIKE '%Metal%'
            ORDER BY sort_weight
        """)
        companies = self.env.cr.dictfetchall()

        return {
            'years': years,
            'companies': companies,
        }

    @api.model
    def get_dashboard_data(self, month_from_year, month_from_month,
                           month_to_year, month_to_month,
                           company_id, display_mode):
        if not all([month_from_year, month_from_month,
                    month_to_year, month_to_month]):
            return self._empty_result([])

        months = []
        y, m = int(month_from_year), int(month_from_month)
        to_y, to_m = int(month_to_year), int(month_to_month)
        while (y, m) <= (to_y, to_m):
            months.append((y, m))
            m += 1
            if m > 12:
                m = 1
                y += 1

        if not months:
            return self._empty_result([])

        start_date = datetime.date(months[0][0], months[0][1], 1)
        last_day = calendar.monthrange(months[-1][0], months[-1][1])[1]
        end_date = datetime.date(months[-1][0], months[-1][1], last_day)

        months = list(reversed(months))

        company_params = []
        company_filter = ''
        if company_id:
            company_filter = 'AND srm.company_id = %s'
            company_params.append(int(company_id))

        mn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
              'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        month_labels = [f"{mn[ym[1]-1]} {str(ym[0])[2:]}" for ym in months]

        if display_mode in HIERARCHICAL_MODES:
            return self._get_hierarchical_data(
                display_mode, months, month_labels,
                start_date, end_date, company_filter, company_params
            )

        group_field = FLAT_FIELD_MAP.get(display_mode, 'srm.customer_name')
        return self._get_flat_data(
            group_field, months, month_labels,
            start_date, end_date, company_filter, company_params
        )


    def _get_flat_data(self, group_field, months, month_labels,
                       start_date, end_date, company_filter, company_params):
        query = """
            SELECT
                {group_field} AS display_name,
                DATE_TRUNC('month', srm.accounting_date)::date AS month_date,
                SUM(srm.quantity)    AS qty,
                SUM(srm.price_total) AS value
            FROM sales_revenue_model srm
            LEFT JOIN res_company rc ON srm.company_id = rc.id
            WHERE srm.accounting_date BETWEEN %s AND %s
              {company_filter}
              AND {group_field} IS NOT NULL
              AND {group_field} != ''
            GROUP BY {group_field}, DATE_TRUNC('month', srm.accounting_date)::date
            ORDER BY {group_field}, month_date
        """.format(group_field=group_field, company_filter=company_filter)

        params = [start_date, end_date] + company_params
        self.env.cr.execute(query, params)
        raw_rows = self.env.cr.dictfetchall()

        pivot = {}
        for row in raw_rows:
            name = row['display_name'] or '(Unknown)'
            md = row['month_date']
            ym = (md.year, md.month)
            if name not in pivot:
                pivot[name] = {}
            pivot[name][ym] = {
                'qty':   float(row['qty']   or 0),
                'value': float(row['value'] or 0),
            }

        grand_qty_months   = [sum(pivot[n].get(ym, {}).get('qty',   0) for n in pivot) for ym in months]
        grand_value_months = [sum(pivot[n].get(ym, {}).get('value', 0) for n in pivot) for ym in months]
        grand_qty_total    = sum(grand_qty_months)
        grand_value_total  = sum(grand_value_months)

        rows = []
        for name, md in pivot.items():
            qty_months   = [md.get(ym, {}).get('qty',   0) for ym in months]
            value_months = [md.get(ym, {}).get('value', 0) for ym in months]
            rows.append({
                'name':         name,
                'qty_total':    sum(qty_months),
                'value_total':  sum(value_months),
                'qty_months':   qty_months,
                'value_months': value_months,
            })
        rows.sort(key=lambda r: r['value_total'], reverse=True)

        return {
            'is_hierarchical':    False,
            'months':             month_labels,
            'rows':               rows,
            'groups':             [],
            'grand_qty_total':    grand_qty_total,
            'grand_value_total':  grand_value_total,
            'grand_qty_months':   grand_qty_months,
            'grand_value_months': grand_value_months,
            'month_count':        len(months),
        }


    def _get_hierarchical_data(self, display_mode, months, month_labels,
                                start_date, end_date, company_filter, company_params):
        cfg = HIERARCHICAL_MODES[display_mode]
        gf  = cfg['group_field']
        cf  = cfg['child_field']

        query = """
            SELECT
                COALESCE({gf}, '(Unknown)') AS group_name,
                COALESCE({cf}, '(Unknown)') AS child_name,
                DATE_TRUNC('month', srm.accounting_date)::date AS month_date,
                SUM(srm.quantity)    AS qty,
                SUM(srm.price_total) AS value
            FROM sales_revenue_model srm
            LEFT JOIN res_company rc ON srm.company_id = rc.id
            WHERE srm.accounting_date BETWEEN %s AND %s
              {company_filter}
              AND {gf} IS NOT NULL
              AND {gf} != ''
            GROUP BY {gf}, {cf}, DATE_TRUNC('month', srm.accounting_date)::date
            ORDER BY {gf}, {cf}, month_date
        """.format(gf=gf, cf=cf, company_filter=company_filter)

        params = [start_date, end_date] + company_params
        self.env.cr.execute(query, params)
        raw_rows = self.env.cr.dictfetchall()

        pivot = {}
        for row in raw_rows:
            gname = row['group_name'] or '(Unknown)'
            cname = row['child_name'] or '(Unknown)'
            md    = row['month_date']
            ym    = (md.year, md.month)
            if gname not in pivot:
                pivot[gname] = {}
            if cname not in pivot[gname]:
                pivot[gname][cname] = {}
            pivot[gname][cname][ym] = {
                'qty':   float(row['qty']   or 0),
                'value': float(row['value'] or 0),
            }

        grand_qty_months   = []
        grand_value_months = []
        for ym in months:
            gq = sum(
                pivot[g][c].get(ym, {}).get('qty', 0)
                for g in pivot for c in pivot[g]
            )
            gv = sum(
                pivot[g][c].get(ym, {}).get('value', 0)
                for g in pivot for c in pivot[g]
            )
            grand_qty_months.append(gq)
            grand_value_months.append(gv)

        grand_qty_total   = sum(grand_qty_months)
        grand_value_total = sum(grand_value_months)

        groups = []
        for gname, children_data in pivot.items():
            group_qty_months   = [0.0] * len(months)
            group_value_months = [0.0] * len(months)
            children = []

            for cname, month_data in children_data.items():
                qty_months   = [month_data.get(ym, {}).get('qty',   0) for ym in months]
                value_months = [month_data.get(ym, {}).get('value', 0) for ym in months]
                children.append({
                    'name':         cname,
                    'qty_total':    sum(qty_months),
                    'value_total':  sum(value_months),
                    'qty_months':   qty_months,
                    'value_months': value_months,
                })
                for i in range(len(months)):
                    group_qty_months[i]   += qty_months[i]
                    group_value_months[i] += value_months[i]

            children.sort(key=lambda r: r['value_total'], reverse=True)

            groups.append({
                'group_name':     gname,
                'qty_total':      sum(group_qty_months),
                'value_total':    sum(group_value_months),
                'qty_months':     group_qty_months,
                'value_months':   group_value_months,
                'children':       children,
            })

        groups.sort(key=lambda g: g['value_total'], reverse=True)

        return {
            'is_hierarchical':    True,
            'months':             month_labels,
            'rows':               [],   
            'groups':             groups,
            'grand_qty_total':    grand_qty_total,
            'grand_value_total':  grand_value_total,
            'grand_qty_months':   grand_qty_months,
            'grand_value_months': grand_value_months,
            'month_count':        len(months),
        }

    def _empty_result(self, months):
        return {
            'is_hierarchical':    False,
            'months':             months,
            'rows':               [],
            'groups':             [],
            'grand_qty_total':    0,
            'grand_value_total':  0,
            'grand_qty_months':   [],
            'grand_value_months': [],
            'month_count':        0,
        }
