from django.test import SimpleTestCase

from system_explanation_services.services.pdf_export import parse_html_table_rows


class PdfTableParseTests(SimpleTestCase):
    def test_editor_table_keeps_rows_and_cells(self):
        html = """
        <table>
          <thead><tr><th>ستون ۱</th><th>ستون ۲</th></tr></thead>
          <tbody>
            <tr><td>الف</td><td>ب</td></tr>
            <tr><td>ج</td><td>د</td></tr>
          </tbody>
        </table>
        """
        rows = parse_html_table_rows(html)
        self.assertEqual(len(rows), 3)
        self.assertEqual(rows[0], ["ستون ۱", "ستون ۲"])
        self.assertEqual(rows[1], ["الف", "ب"])
        self.assertEqual(rows[2], ["ج", "د"])
