import { useEffect, useState } from 'react';
import { api, fmtDate } from '../api';
import { Modal, DocumentShell, DocCustomizeHint } from '../components';

export default function CertificateView({ student, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (student) {
      setLoading(true);
      api.get(`/certificates/${student.id}`).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
    } else setData(null);
  }, [student]);

  if (!student) return null;
  const sch = data?.school;
  const name = data?.student ? `${data.student.first_name} ${data.student.last_name}` : `${student.first_name} ${student.last_name}`;

  return (
    <Modal open onClose={onClose} title="Certificat de scolarité" size="lg"
      footer={
        <>
          <button className="btn btn-outline" onClick={onClose}>Fermer</button>
          <button className="btn btn-primary" onClick={() => window.print()}>Imprimer / PDF</button>
        </>
      }>
      <div className="no-print" style={{ marginBottom: 12 }}>
        {loading && <div className="muted">Chargement du certificat…</div>}
      </div>
      <DocCustomizeHint />
      <DocumentShell
        school={sch}
        docNumber="CERTIFICAT DE SCOLARITÉ"
        docKind="SCOLARITÉ"
        kindTone="green"
        date={fmtDate(new Date().toISOString())}
        title="Certificat de scolarité"
        footer={
          <div className="doc-foot">
            <div />
            <div style={{ textAlign: 'center' }}>
              <div className="muted" style={{ fontSize: 11 }}>Fait à {sch?.address || '__________________'} le {fmtDate(new Date().toISOString())}</div>
              <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>Signature et cachet de l'établissement</div>
              <div style={{ height: 44 }} />
            </div>
            <div />
          </div>
        }>
        {data?.student && sch && (
          <div style={{ lineHeight: 2, fontSize: 14 }}>
            <p style={{ textAlign: 'justify', margin: '4px 0 16px' }}>
              Nous soussigné{sch?.name ? `, ${sch.name}` : ''}, certifions que l'élève{' '}
              <b>{name}</b>
              {data.student.birth_date && <span>, né(e) le <b>{fmtDate(data.student.birth_date)}</b></span>}
              {data.student.birth_place && <span> à <b>{data.student.birth_place}</b></span>}
              {data.student.parent_name && <span>, {data.student.gender === 'F' ? 'fille de' : 'fils de'} <b>{data.student.parent_name}</b></span>},
              {data.enrolled
                ? <> est régulièrement inscrit{data.student.gender === 'F' ? 'e' : ''} dans notre établissement en classe de <b>{data.class_name}</b> pour l'année scolaire <b>{data.year_label}</b>, où {data.student.gender === 'F' ? 'elle' : 'il'} fréquente assidûment les cours.</>
                : <> n'est pas inscrit{data.student.gender === 'F' ? 'e' : ''} dans notre établissement pour l'année scolaire courante.</>}
            </p>
            <p style={{ textAlign: 'justify', margin: 0 }}>
              Le présent certificat est délivré à l'intéressé{data.student.gender === 'F' ? 'e' : ''} pour servir et valoir ce que de droit.
            </p>
          </div>
        )}
      </DocumentShell>
    </Modal>
  );
}
