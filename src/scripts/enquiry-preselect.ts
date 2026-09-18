/**
 * Preselects the enquiry type and product from the URL, e.g.
 * /contact/?enquiry=product&product=surgical-disposable-gowns
 *
 * Both values are checked against the options actually present in the selects,
 * so anything else in the query string is ignored.
 */

const params = new URLSearchParams(window.location.search);

function preselect(selectId: string, value: string | null): void {
  if (!value) return;
  const select = document.querySelector<HTMLSelectElement>(`#${selectId}`);
  if (!select) return;
  const allowed = Array.from(select.options).some((option) => option.value === value);
  if (allowed) select.value = value;
}

preselect("enquiryType", params.get("enquiry"));
preselect("product", params.get("product"));
