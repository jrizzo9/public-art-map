import styles from "./submit.module.css";

const AIRTABLE_FORM_SRC =
  "https://airtable.com/embed/appmMvsC1OdS2i1tG/pagKSb2hxTaBuu3iL/form";

export function AirtableSubmitEmbed() {
  return (
    <div className={styles.embedWrap}>
      <iframe
        className={`airtable-embed ${styles.embed}`}
        src={AIRTABLE_FORM_SRC}
        title="Suggest artwork for the Public Art Map"
        width="100%"
      />
    </div>
  );
}
