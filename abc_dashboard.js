/** @odoo-module **/
import { Component, useState, onWillStart } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

const HIERARCHICAL_MODES = new Set(['customer_group', 'buyer_group', 'country']);

class AbcDashboard extends Component {
    setup() {
        this.orm = useService("orm");

        const now = new Date();
        const toYear = now.getFullYear();
        const toMonth = now.getMonth() + 1;
        let fromYear = toYear;
        let fromMonth = toMonth - 11;
        if (fromMonth <= 0) { fromMonth += 12; fromYear -= 1; }

        this.state = useState({
            filters: {
                monthFromYear: fromYear,
                monthFromMonth: fromMonth,
                monthToYear: toYear,
                monthToMonth: toMonth,
                companyId: null,
                type: 'value',
                displayMode: 'customer',
            },
            showMonthFromPicker: false,
            showMonthToPicker: false,
            pickerFromYear: fromYear,
            pickerToYear: toYear,
            yearOptions: [],
            companyOptions: [],
            selectedCompany: null,
            loading: false,
            months: [],
            rows: [],
            groups: [],
            isHierarchical: false,
            grandQtyTotal: 0,
            grandValueTotal: 0,
            grandQtyMonths: [],
            grandValueMonths: [],
            monthCount: 0,
        });

        onWillStart(async () => {
            const opts = await this.orm.call("abc.dashboard", "get_filter_options", []);
            this.state.yearOptions = opts.years || [];
            this.state.companyOptions = opts.companies || [];
            const zipperCo = (opts.companies || []).find(
                c => c.name && c.name.toLowerCase().includes("zipper")
            );
            if (zipperCo) {
                this.state.selectedCompany = zipperCo.id;
                this.state.filters.companyId = zipperCo.id;
            }
            await this.loadData();
        });
    }

    async loadData() {
        this.state.loading = true;
        try {
            const f = this.state.filters;
            const data = await this.orm.call(
                "abc.dashboard", "get_dashboard_data",
                [f.monthFromYear, f.monthFromMonth, f.monthToYear, f.monthToMonth, f.companyId, f.displayMode]
            );
            this.state.months = data.months || [];
            this.state.rows = data.rows || [];
            this.state.groups = data.groups || [];
            this.state.isHierarchical = data.is_hierarchical || false;
            this.state.grandQtyTotal = data.grand_qty_total || 0;
            this.state.grandValueTotal = data.grand_value_total || 0;
            this.state.grandQtyMonths = data.grand_qty_months || [];
            this.state.grandValueMonths = data.grand_value_months || [];
            this.state.monthCount = data.month_count || 0;
        } catch (err) {
            console.error("ABC Dashboard: load error", err);
        } finally {
            this.state.loading = false;
        }
    }

    async applyFilters() {
        this.state.filters.companyId = this.state.selectedCompany;
        await this.loadData();
    }

    clearFilters() {
        const now = new Date();
        const toYear = now.getFullYear();
        const toMonth = now.getMonth() + 1;
        let fromYear = toYear;
        let fromMonth = toMonth - 11;
        if (fromMonth <= 0) { fromMonth += 12; fromYear -= 1; }
        this.state.filters.monthFromYear = fromYear;
        this.state.filters.monthFromMonth = fromMonth;
        this.state.filters.monthToYear = toYear;
        this.state.filters.monthToMonth = toMonth;
        this.state.filters.type = 'value';
        this.state.filters.displayMode = 'customer';
        const zipperCo = this.state.companyOptions.find(c => c.name && c.name.toLowerCase().includes("zipper"));
        if (zipperCo) {
            this.state.selectedCompany = zipperCo.id;
            this.state.filters.companyId = zipperCo.id;
        }
        this.state.pickerFromYear = fromYear;
        this.state.pickerToYear = toYear;
        this.applyFilters();
    }

    selectCompany(id) {
        this.state.selectedCompany = id;
        this.state.filters.companyId = id;
        this.applyFilters();
    }

    selectType(type) {
        this.state.filters.type = type;
    }

    onDisplayModeChange(ev) {
        this.state.filters.displayMode = ev.target.value;
        this.applyFilters();
    }

    toggleMonthFromPicker() {
        this.state.showMonthFromPicker = !this.state.showMonthFromPicker;
        this.state.showMonthToPicker = false;
        if (this.state.showMonthFromPicker) this.state.pickerFromYear = this.state.filters.monthFromYear;
    }
    selectMonthFrom(monthIndex) {
        this.state.filters.monthFromYear = this.state.pickerFromYear;
        this.state.filters.monthFromMonth = monthIndex + 1;
        this.state.showMonthFromPicker = false;
        this.applyFilters();
    }
    selectYear(which, year) {
        if (which === 'from') this.state.pickerFromYear = year;
        else this.state.pickerToYear = year;
    }
    clearMonthFrom() { this.state.showMonthFromPicker = false; }
    selectCurrentMonthFrom() {
        const now = new Date();
        this.state.filters.monthFromYear = now.getFullYear();
        this.state.filters.monthFromMonth = now.getMonth() + 1;
        this.state.pickerFromYear = now.getFullYear();
        this.state.showMonthFromPicker = false;
        this.applyFilters();
    }

    toggleMonthToPicker() {
        this.state.showMonthToPicker = !this.state.showMonthToPicker;
        this.state.showMonthFromPicker = false;
        if (this.state.showMonthToPicker) this.state.pickerToYear = this.state.filters.monthToYear;
    }
    selectMonthTo(monthIndex) {
        this.state.filters.monthToYear = this.state.pickerToYear;
        this.state.filters.monthToMonth = monthIndex + 1;
        this.state.showMonthToPicker = false;
        this.applyFilters();
    }
    clearMonthTo() { this.state.showMonthToPicker = false; }
    selectCurrentMonthTo() {
        const now = new Date();
        this.state.filters.monthToYear = now.getFullYear();
        this.state.filters.monthToMonth = now.getMonth() + 1;
        this.state.pickerToYear = now.getFullYear();
        this.state.showMonthToPicker = false;
        this.applyFilters();
    }

    getMonthDisplay(year, month) {
        const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${names[month - 1]} ${year}`;
    }
    getMonthFromDisplay() { return this.getMonthDisplay(this.state.filters.monthFromYear, this.state.filters.monthFromMonth); }
    getMonthToDisplay()   { return this.getMonthDisplay(this.state.filters.monthToYear,   this.state.filters.monthToMonth);   }

    isMonthFromActive(year, monthIndex) {
        return this.state.pickerFromYear === year && this.state.filters.monthFromYear === year && this.state.filters.monthFromMonth === monthIndex + 1;
    }
    isMonthToActive(year, monthIndex) {
        return this.state.pickerToYear === year && this.state.filters.monthToYear === year && this.state.filters.monthToMonth === monthIndex + 1;
    }

    getDisplayModeLabel() {
        const map = {
            customer: 'Customer', customer_group: 'Customer Group',
            buyer_name: 'Buyer', buyer_group: 'Buyer Group',
            sales_person: 'Sales Person', sales_team: 'Sales Team',
            item: 'Item', country: 'Country',
        };
        return map[this.state.filters.displayMode] || 'Customer';
    }

    getLastUpdate() {
        const now = new Date();
        const updateTime = new Date(now);
        updateTime.setHours(6, 0, 0, 0);
        if (now < updateTime) updateTime.setDate(updateTime.getDate() - 1);
        return updateTime.toLocaleString('en-GB', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: true,
        });
    }

    fmt(value, decimals = 0) {
        if (value === null || value === undefined) return '-';
        const n = Number(value);
        if (!Number.isFinite(n)) return '-';
        return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    }
    fmtDec(value) { return this.fmt(value, 2); }

    isQty() { return this.state.filters.type === 'qty'; }

    getRowTotal(row)  { return this.isQty() ? row.qty_total   : row.value_total; }
    getGrandTotal()   { return this.isQty() ? this.state.grandQtyTotal  : this.state.grandValueTotal; }
    getAvg(row)       { return this.getRowTotal(row)  / (this.state.monthCount || 1); }
    getGrandAvg()     { return this.getGrandTotal()   / (this.state.monthCount || 1); }
    getUnitPrice(row) { return row.qty_total ? row.value_total / row.qty_total : 0; }
    getGrandUnitPrice() { return this.state.grandQtyTotal ? this.state.grandValueTotal / this.state.grandQtyTotal : 0; }
    getShare(row)     { const g = this.getGrandTotal(); return g ? (this.getRowTotal(row) / g) * 100 : 0; }
    getMonthVal(row, idx)  { return this.isQty() ? (row.qty_months[idx] || 0) : (row.value_months[idx] || 0); }
    getGrandMonthVal(idx)  { return this.isQty() ? (this.state.grandQtyMonths[idx] || 0) : (this.state.grandValueMonths[idx] || 0); }
    shareClass(row)   { return this.getShare(row) >= 10 ? 'share-top' : 'share-normal'; }

    xmlEscape(v) {
        return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    xCell(value, styleId = null, type = "String", mergeAcross = 0) {
        const sa = styleId ? ` ss:StyleID="${styleId}"` : "";
        const ma = mergeAcross > 0 ? ` ss:MergeAcross="${mergeAcross}"` : "";
        if (type === "Number") {
            const n = Number(value || 0);
            return `<Cell${sa}${ma}><Data ss:Type="Number">${Number.isFinite(n) ? n : 0}</Data></Cell>`;
        }
        return `<Cell${sa}${ma}><Data ss:Type="String">${this.xmlEscape(String(value ?? ""))}</Data></Cell>`;
    }

    async exportToExcel() {
        this.state.loading = true;
        try {
            const f = this.state.filters;
            const allModes = [
                { key: 'customer',       label: 'Customer',        hierarchical: false },
                { key: 'customer_group', label: 'Customer Group',  hierarchical: true  },
                { key: 'buyer_name',     label: 'Buyer',           hierarchical: false },
                { key: 'buyer_group',    label: 'Buyer Group',     hierarchical: true  },
                { key: 'sales_person',   label: 'Sales Person',    hierarchical: false },
                { key: 'sales_team',     label: 'Sales Team',      hierarchical: false },
                { key: 'item',           label: 'Item',            hierarchical: false },
                { key: 'country',        label: 'Country',         hierarchical: true  },
            ];

            const co = this.state.companyOptions.find(c => c.id === this.state.selectedCompany);
            const companyName = co ? co.name : 'All Companies';

            const allData = await Promise.all(
                allModes.map(mode => this.orm.call("abc.dashboard", "get_dashboard_data", [
                    f.monthFromYear, f.monthFromMonth, f.monthToYear, f.monthToMonth, f.companyId, mode.key,
                ]))
            );

            const styles = `<Styles>
  <Style ss:ID="info"><Font ss:Bold="1" ss:Color="#FFFFFF" ss:Size="9"/><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Interior ss:Color="#875A7B" ss:Pattern="Solid"/></Style>
  <Style ss:ID="infoVal"><Font ss:Bold="1" ss:Size="9"/><Alignment ss:Horizontal="Left" ss:Vertical="Center"/><Interior ss:Color="#f3eef7" ss:Pattern="Solid"/></Style>
  <Style ss:ID="hdrTop"><Font ss:Bold="1" ss:Color="#FFFFFF" ss:Size="9"/><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Interior ss:Color="#875A7B" ss:Pattern="Solid"/></Style>
  <Style ss:ID="hdrSub"><Font ss:Bold="1" ss:Color="#FFFFFF" ss:Size="8"/><Alignment ss:Horizontal="Center"/><Interior ss:Color="#a07090" ss:Pattern="Solid"/></Style>
  <Style ss:ID="groupHdr"><Font ss:Bold="1" ss:Size="9"/><Alignment ss:Horizontal="Left"/><Interior ss:Color="#e8dff0" ss:Pattern="Solid"/></Style>
  <Style ss:ID="groupNum"><Font ss:Bold="1" ss:Size="9"/><Alignment ss:Horizontal="Right"/><Interior ss:Color="#e8dff0" ss:Pattern="Solid"/><NumberFormat ss:Format="#,##0.00"/></Style>
  <Style ss:ID="groupNumInt"><Font ss:Bold="1" ss:Size="9"/><Alignment ss:Horizontal="Right"/><Interior ss:Color="#e8dff0" ss:Pattern="Solid"/><NumberFormat ss:Format="#,##0"/></Style>
  <Style ss:ID="grandLabel"><Font ss:Bold="1" ss:Size="9"/><Alignment ss:Horizontal="Left"/><Interior ss:Color="#d4c4e0" ss:Pattern="Solid"/></Style>
  <Style ss:ID="grandNum"><Font ss:Bold="1" ss:Size="9"/><Alignment ss:Horizontal="Right"/><Interior ss:Color="#d4c4e0" ss:Pattern="Solid"/><NumberFormat ss:Format="#,##0.00"/></Style>
  <Style ss:ID="grandNumInt"><Font ss:Bold="1" ss:Size="9"/><Alignment ss:Horizontal="Right"/><Interior ss:Color="#d4c4e0" ss:Pattern="Solid"/><NumberFormat ss:Format="#,##0"/></Style>
  <Style ss:ID="grandPct"><Font ss:Bold="1" ss:Size="9"/><Alignment ss:Horizontal="Right"/><Interior ss:Color="#d4c4e0" ss:Pattern="Solid"/></Style>
  <Style ss:ID="childTxt"><Font ss:Size="9"/><Alignment ss:Horizontal="Left" ss:Indent="2"/></Style>
  <Style ss:ID="txt"><Font ss:Size="9"/><Alignment ss:Horizontal="Left"/></Style>
  <Style ss:ID="num"><Font ss:Size="9"/><Alignment ss:Horizontal="Right"/><NumberFormat ss:Format="#,##0.00"/></Style>
  <Style ss:ID="numInt"><Font ss:Size="9"/><Alignment ss:Horizontal="Right"/><NumberFormat ss:Format="#,##0"/></Style>
  <Style ss:ID="pct"><Font ss:Size="9" ss:Color="#c0540a"/><Alignment ss:Horizontal="Right"/></Style>
  <Style ss:ID="groupPct"><Font ss:Bold="1" ss:Size="9"/><Alignment ss:Horizontal="Right"/><Interior ss:Color="#e8dff0" ss:Pattern="Solid"/></Style>
</Styles>`;

            const C = (v, s, t, m) => this.xCell(v, s, t, m);

            const buildSheet = (modeLabel, data) => {
                const months = data.months || [];
                const gQtyT  = data.grand_qty_total    || 0;
                const gValT  = data.grand_value_total  || 0;
                const gQtyM  = data.grand_qty_months   || [];
                const gValM  = data.grand_value_months || [];
                const mc     = data.month_count        || 1;
                const gUp    = gQtyT ? gValT / gQtyT : 0;
                const isH    = data.is_hierarchical;

                const colDefs = [
                    `<Column ss:Width="200"/>`,
                    `<Column ss:Width="80"/>`,  `<Column ss:Width="90"/>`,
                    `<Column ss:Width="75"/>`,  `<Column ss:Width="85"/>`,
                    `<Column ss:Width="70"/>`,  `<Column ss:Width="60"/>`,
                    ...months.flatMap(() => [`<Column ss:Width="75"/>`, `<Column ss:Width="85"/>`]),
                ].join('');

                const infoRow = `<Row ss:Height="16">
  ${C('Company', 'info')}${C(companyName, 'infoVal')}
  ${C('Month From', 'info')}${C(this.getMonthFromDisplay(), 'infoVal')}
  ${C('Month To', 'info')}${C(this.getMonthToDisplay(), 'infoVal')}
  ${C('Display Mode', 'info')}${C(modeLabel, 'infoVal')}
</Row><Row ss:Height="4"></Row>`;

                const topRow = `<Row ss:Height="16">
  ${C(modeLabel, 'hdrTop')}
  ${C('Total', 'hdrTop', 'String', 1)}
  ${C('Avg.', 'hdrTop', 'String', 1)}
  ${C('Unit Price', 'hdrTop')}
  ${C('Share %', 'hdrTop')}
  ${months.map(m => C(m, 'hdrTop', 'String', 1)).join('')}
</Row>`;

                const subRow = `<Row ss:Height="14">
  ${C('', 'hdrSub')}
  ${C('Qty', 'hdrSub')}${C('Value', 'hdrSub')}
  ${C('Qty', 'hdrSub')}${C('Value', 'hdrSub')}
  ${C('', 'hdrSub')}${C('', 'hdrSub')}
  ${months.map(() => `${C('Qty', 'hdrSub')}${C('Value', 'hdrSub')}`).join('')}
</Row>`;

                const grandRow = `<Row>
  ${C('TOTAL', 'grandLabel')}
  ${C(gQtyT, 'grandNumInt', 'Number')}${C(gValT, 'grandNum', 'Number')}
  ${C(gQtyT / mc, 'grandNumInt', 'Number')}${C(gValT / mc, 'grandNum', 'Number')}
  ${C(gUp, 'grandNum', 'Number')}
  ${C('100%', 'grandPct')}
  ${months.map((_, i) => `${C(gQtyM[i] || 0, 'grandNumInt', 'Number')}${C(gValM[i] || 0, 'grandNum', 'Number')}`).join('')}
</Row>`;

                let dataRows = '';
                if (isH) {
                    for (const grp of (data.groups || [])) {
                        const qT = grp.qty_total || 0;
                        const vT = grp.value_total || 0;
                        const up = qT ? vT / qT : 0;
                        const sh = gValT ? (vT / gValT) * 100 : 0;
                        dataRows += `<Row>
  ${C(grp.group_name || '', 'groupHdr')}
  ${C(qT, 'groupNumInt', 'Number')}${C(vT, 'groupNum', 'Number')}
  ${C(qT / mc, 'groupNumInt', 'Number')}${C(vT / mc, 'groupNum', 'Number')}
  ${C(up, 'groupNum', 'Number')}
  ${C(this.fmt(sh, 2) + '%', 'groupPct')}
  ${months.map((_, i) => `${C(grp.qty_months[i] || 0, 'groupNumInt', 'Number')}${C(grp.value_months[i] || 0, 'groupNum', 'Number')}`).join('')}
</Row>`;
                        for (const child of (grp.children || [])) {
                            const cqT = child.qty_total || 0;
                            const cvT = child.value_total || 0;
                            const cup = cqT ? cvT / cqT : 0;
                            const csh = gValT ? (cvT / gValT) * 100 : 0;
                            dataRows += `<Row>
  ${C('  ' + (child.name || ''), 'childTxt')}
  ${C(cqT, 'numInt', 'Number')}${C(cvT, 'num', 'Number')}
  ${C(cqT / mc, 'numInt', 'Number')}${C(cvT / mc, 'num', 'Number')}
  ${C(cup, 'num', 'Number')}
  ${C(this.fmt(csh, 2) + '%', 'pct')}
  ${months.map((_, i) => `${C(child.qty_months[i] || 0, 'numInt', 'Number')}${C(child.value_months[i] || 0, 'num', 'Number')}`).join('')}
</Row>`;
                        }
                    }
                } else {
                    for (const row of (data.rows || [])) {
                        const qT = row.qty_total || 0;
                        const vT = row.value_total || 0;
                        const up = qT ? vT / qT : 0;
                        const sh = gValT ? (vT / gValT) * 100 : 0;
                        dataRows += `<Row>
  ${C(row.name || '', 'txt')}
  ${C(qT, 'numInt', 'Number')}${C(vT, 'num', 'Number')}
  ${C(qT / mc, 'numInt', 'Number')}${C(vT / mc, 'num', 'Number')}
  ${C(up, 'num', 'Number')}
  ${C(this.fmt(sh, 2) + '%', 'pct')}
  ${months.map((_, i) => `${C(row.qty_months[i] || 0, 'numInt', 'Number')}${C(row.value_months[i] || 0, 'num', 'Number')}`).join('')}
</Row>`;
                    }
                }

                const sheetName = modeLabel.replace(/[:\\\/\?\*\[\]]/g, '').slice(0, 31);
                return `<Worksheet ss:Name="${this.xmlEscape(sheetName)}">
<Table>${colDefs}${infoRow}${topRow}${subRow}${grandRow}${dataRows}</Table>
</Worksheet>`;
            };

            const worksheets = allModes.map((mode, i) => buildSheet(mode.label, allData[i])).join('\n');

            const xml = `<?xml version="1.0"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
${styles}${worksheets}
</Workbook>`;

            const blob = new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8;" });
            const url  = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href  = url;
            link.download = `abc_dashboard_${this.getMonthFromDisplay()}_to_${this.getMonthToDisplay()}.xls`.replace(/\s/g, '_');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error("ABC Dashboard: Excel export error", err);
            alert("Export failed. Please try again.");
        } finally {
            this.state.loading = false;
        }
    }
}

AbcDashboard.template = "abc_dashboard_template";
registry.category("actions").add("action_abc_dashboard", AbcDashboard);
