import React, { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import '../styles/Agreement.css';

export default function AgreementPage() {
  const sigCanvas = useRef(null);
  const componentRef = useRef(null);
  const [signature, setSignature] = useState("");

  const handleDownloadPdf = async () => {
    const element = componentRef.current;
    
    element.classList.add('pdf-mode');

    const inputs = element.querySelectorAll('input.dotted-field');
    const spans = [];
    inputs.forEach(input => {
      const span = document.createElement('span');
      span.textContent = input.value || ' ';
      span.className = 'pdf-input-span';
      span.style.cssText = `
        display: inline-block;
        min-width: ${input.offsetWidth}px;
        color: #0b2b3b;
        font-family: inherit;
        font-size: inherit;
        padding: 0 4px;
      `;
      input.parentNode.insertBefore(span, input);
      input.style.display = 'none';
      spans.push({ input, span });
    });

    // Dynamic recursive DOM traversal to capture ALL blocks in exact sequential order
    const getAtomics = (root) => {
      const blocks = [];
      const containers = [];
      const traverse = (node) => {
        for (let i = 0; i < node.children.length; i++) {
          const child = node.children[i];
          if (child.tagName === 'SCRIPT' || child.tagName === 'STYLE' || child.style.display === 'none' || child.hasAttribute('data-html2canvas-ignore')) {
            continue;
          }
          if (child.classList.contains('annex-box') || child.classList.contains('table-wrap') || child.tagName === 'TABLE' || child.tagName === 'TBODY') {
            containers.push(child);
            traverse(child);
          } else if (child.tagName === 'THEAD' || child.tagName === 'TFOOT') {
            // Ignore, let them inherit visibility from TABLE automatically
          } else {
            blocks.push(child);
          }
        }
      };
      traverse(root);
      return { atomics: blocks, parents: containers };
    };

    let allAtomics = [];
    let allParents = [];

    try {
      const { atomics, parents } = getAtomics(element);
      allAtomics = atomics;
      allParents = parents;

      // Save original display styles to preserve inline flex/grid layouts perfectly
      atomics.forEach(el => el.dataset.origDisplay = el.style.display || '');
      parents.forEach(el => el.dataset.origDisplay = el.style.display || '');

      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 10;
      const printableWidth = pageWidth - margin * 2;
      const printableHeight = pageHeight - margin * 2;
      
      const pxPerMM = element.offsetWidth / printableWidth;
      const MAX_PAGE_HEIGHT_PX = printableHeight * pxPerMM;

      const wrapperStyle = window.getComputedStyle(element);
      const wrapperPadding = (parseFloat(wrapperStyle.paddingTop) || 0) + (parseFloat(wrapperStyle.paddingBottom) || 0);
      const SAFE_PAGE_HEIGHT_PX = MAX_PAGE_HEIGHT_PX - wrapperPadding - 40;

      const wrapperTop = element.getBoundingClientRect().top;
      const elementMetrics = atomics.map(el => {
        const rect = el.getBoundingClientRect();
        return {
          el,
          top: rect.top - wrapperTop,
          bottom: rect.bottom - wrapperTop,
          tagName: el.tagName
        };
      });

      const pages = [];
      let currentPageAtomics = [];
      let pageStartY = 0;

      for (let i = 0; i < elementMetrics.length; i++) {
        const metric = elementMetrics[i];
        
        let effectiveBottom = metric.bottom;
        if (['H2', 'H3', 'H4', 'H5'].includes(metric.tagName) && i + 1 < elementMetrics.length) {
          effectiveBottom = elementMetrics[i + 1].bottom;
        }

        if (effectiveBottom - pageStartY > SAFE_PAGE_HEIGHT_PX && currentPageAtomics.length > 0) {
          pages.push(currentPageAtomics);
          currentPageAtomics = [metric.el];
          pageStartY = elementMetrics[i - 1].bottom;
        } else {
          currentPageAtomics.push(metric.el);
        }
      }
      if (currentPageAtomics.length > 0) {
        pages.push(currentPageAtomics);
      }

      for (let i = 0; i < pages.length; i++) {
        const pageAtomics = pages[i];

        atomics.forEach(el => el.style.display = 'none');
        pageAtomics.forEach(el => el.style.display = el.dataset.origDisplay);

        parents.forEach(parent => {
          const hasVisibleAtomic = atomics.some(child => 
            parent.contains(child) && child.style.display !== 'none'
          );
          parent.style.display = hasVisibleAtomic ? parent.dataset.origDisplay : 'none';
        });

        await new Promise(resolve => setTimeout(resolve, 50));

        const canvas = await html2canvas(element, { scale: 2, useCORS: true, logging: false, scrollY: 0 });
        const imgData = canvas.toDataURL('image/jpeg', 0.98);
        
        if (i > 0) pdf.addPage();
        
        let finalWidth = printableWidth;
        let finalHeight = (canvas.height * finalWidth) / canvas.width;
        
        if (finalHeight > printableHeight) {
           const scale = printableHeight / finalHeight;
           finalWidth = finalWidth * scale;
           finalHeight = printableHeight;
        }
        
        pdf.addImage(imgData, 'JPEG', margin, margin, finalWidth, finalHeight);
      }

      pdf.save('Service_Partner_Agreement.pdf');

    } catch (error) {
      console.error("PDF Generation Error:", error);
      alert("An error occurred while generating the PDF.");
    } finally {
      element.classList.remove('pdf-mode');
      
      allAtomics.forEach(el => {
        el.style.display = el.dataset.origDisplay;
        delete el.dataset.origDisplay;
      });
      
      allParents.forEach(parent => {
        parent.style.display = parent.dataset.origDisplay;
        delete parent.dataset.origDisplay;
      });
      
      spans.forEach(({ input, span }) => {
        input.style.display = '';
        span.remove();
      });
    }
  };

  const clearSignature = () => {
    sigCanvas.current.clear();
    setSignature("");
  };

  const saveSignature = () => {
    if (sigCanvas.current.isEmpty()) {
      alert("Please draw your signature first.");
      return;
    }

    const image = sigCanvas.current
      .getTrimmedCanvas()
      .toDataURL("image/png");

    setSignature(image);
    console.log("Base64 Signature:", image);
  };

  return (
    <>
      <div className="agreement-wrapper" style={{ margin: '0 auto' }} ref={componentRef}>
        {/* header */}
        <div className="logo-header">
          <span className="logo-placeholder">🧹 THE NEATIFY TEAM <small>OPC</small></span>
          <span style={{ fontWeight: 300, color: '#3a6177', marginLeft: 'auto', fontSize: '0.9rem' }}>SERVICE PARTNER AGREEMENT</span>
        </div>

        {/* address */}
        <div className="address-block">
          <strong>Registered / Corporate Office</strong><br />
          4th Floor, Door No. 1-4A, 1-4B, Serilingampally, Nallagandla Road, Gopanpalle, Hyderabad, Telangana – 500046
        </div>

        {/* between */}
        <div className="party-section">
          <div className="party-box"><strong>Company</strong><span className="name">THE NEATIFY TEAM (OPC) PRIVATE LIMITED</span></div>
          <div className="party-box"><strong>Partner</strong>
            <div className="field-line">Name: <input type="text" className="dotted-field" /></div>
            <div className="field-line">Mobile: <input type="text" className="dotted-field" /></div>
            <div className="field-line">Address: <input type="text" className="dotted-field" /></div>
          </div>
        </div>

        <p><em>The Company and the Partner are individually referred to as a <strong>"Party"</strong> and collectively as the <strong>"Parties."</strong> The Partner agrees to provide services in accordance with the terms and conditions of this Agreement and the Annexures attached hereto.</em></p>

        {/* 1. PURPOSE */}
        <h2>1. PURPOSE AND SCOPE</h2>
        <div className="clause"><strong>1.1</strong> The purpose of this Agreement is to establish the terms and conditions under which the Partner may provide residential cleaning and related services assigned through or by the Company.</div>
        <div className="clause"><strong>1.2</strong> The Partner shall perform all assigned services professionally, safely, diligently, and in accordance with the Company's applicable Standard Operating Procedures ("SOPs"), service standards, safety requirements, operational guidelines, and customer service requirements.</div>
        <div className="clause"><strong>1.3</strong> The detailed Partner Kit, equipment requirements, working requirements, cancellation procedures, reactivation requirements, Partner Price Per Session, and applicable chemical and consumable rates are set out in <strong>Annexure–A</strong> and <strong>Annexure–B</strong>.</div>
        <div className="clause"><strong>1.4</strong> The Annexures attached to this Agreement shall form an integral part of this Agreement and shall be read together with the main Agreement.</div>

        {/* 2. PARTNER KIT */}
        <h2>2. PARTNER KIT</h2>
        <div className="clause"><strong>2.1</strong> Every Partner shall purchase the prescribed <strong>The Neatify Team Partner Kit</strong> applicable to the services to be performed by the Partner before commencing or continuing service operations.</div>
        <div className="clause"><strong>2.2</strong> The Partner Kit shall contain the equipment, uniform, cleaning materials, chemicals, consumables, safety items, accessories, and other materials prescribed by the Company.</div>
        <div className="clause"><strong>2.3</strong> The detailed Partner Kit price, payment terms, item list, specifications, maintenance obligations, and replacement terms are provided in <strong>Annexure–A</strong>.</div>
        <div className="clause"><strong>2.4</strong> The Partner shall maintain the Partner Kit and all required equipment in good working condition and shall comply with the Company's applicable maintenance, safety, and usage requirements.</div>

        {/* 3. CHEMICALS */}
        <h2>3. CHEMICALS AND CONSUMABLES</h2>
        <div className="clause"><strong>3.1</strong> The Partner shall use only Company-approved chemicals and consumables while performing Company-assigned services.</div>
        <div className="clause"><strong>3.2</strong> The Partner shall not use unauthorized, counterfeit, expired, substituted, or improperly diluted chemicals or products without prior written approval from the Company.</div>
        <div className="clause"><strong>3.3</strong> The detailed approved chemical and consumable rate card applicable to the Partner is provided in <strong>Annexure–B</strong>.</div>
        <div className="clause"><strong>3.4</strong> The cost of chemicals and consumables supplied by the Company may be recovered from the Partner's wallet, service earnings, or through another payment method mutually agreed between the Company and the Partner, subject to applicable law.</div>
        <div className="clause"><strong>3.5</strong> The Partner shall maintain sufficient stock of approved chemicals and consumables necessary to complete assigned services in accordance with Company standards.</div>
        <div className="clause"><strong>3.6</strong> If the Company determines, based on reasonable evidence or inspection, that the Partner has used unauthorized chemicals or consumables while performing Company bookings, the Company may, subject to applicable law:
          <ul>
            <li>Suspend or restrict booking allocations;</li>
            <li>Disqualify the Partner from the Minimum Earnings Guarantee Scheme or applicable incentive programs;</li>
            <li>Require reasonable rework or corrective service without additional Partner Price, where applicable;</li>
            <li>Recover documented and proven losses directly caused by such violation, to the extent legally permissible; and/or</li>
            <li>Terminate this Agreement in the event of a material or repeated breach.</li>
          </ul>
        </div>

        {/* 4. BOOKINGS */}
        <h2>4. PARTNER BOOKINGS AND SERVICE DELIVERY</h2>
        <div className="clause"><strong>4.1</strong> The Partner shall accept and complete assigned service bookings in accordance with the Company's operational requirements and applicable booking procedures.</div>
        <div className="clause"><strong>4.2</strong> The Partner shall remain available during the committed availability hours and shall not intentionally remain logged in while being unavailable, unreachable, or unable to attend assigned services.</div>
        <div className="clause"><strong>4.3</strong> The Partner shall immediately inform the Company through the prescribed communication channel if the Partner is unable to attend an assigned booking.</div>
        <div className="clause"><strong>4.4</strong> Repeated cancellation, refusal to accept assigned bookings, late arrival, failure to attend confirmed bookings, or failure to comply with Company SOPs may result in appropriate action under this Agreement.</div>
        <div className="clause"><strong>4.5</strong> The detailed cancellation and reactivation procedures are set out in <strong>Annexure–A</strong>.</div>

        {/* 5. PRICE & PAYMENT */}
        <h2>5. PARTNER PRICE AND PAYMENT</h2>
        <div className="clause"><strong>5.1</strong> The Partner shall be eligible to receive the applicable Partner Price Per Session for successfully completed and verified service bookings, subject to the terms and conditions specified in <strong>Annexure–B</strong>.</div>
        <div className="clause"><strong>5.2</strong> The applicable Partner Price shall be determined based on: service type; service category; property size; scope of work; and booking details assigned to the Partner.</div>
        <div className="clause"><strong>5.3</strong> Partner payments shall be calculated based on successfully completed and verified service sessions and the applicable Partner Price.</div>
        <div className="clause"><strong>5.4</strong> Payments may be subject to applicable deductions, adjustments, approved recoveries, customer refunds, penalties, or other amounts permitted under this Agreement and applicable law.</div>
        <div className="clause"><strong>5.5</strong> The Company may temporarily hold or review a payment where a booking is under investigation due to: customer complaint; suspected fraud; service quality issue; damage claim; or violation of Company policies.</div>
        <div className="clause"><strong>5.6</strong> The Partner shall not independently negotiate, alter, promise, or communicate a different Partner Price to customers without prior authorization from the Company.</div>
        <div className="clause"><strong>5.7</strong> The detailed Partner Price Per Session and payment conditions are provided in <strong>Annexure–B</strong>.</div>

        {/* 6. RECORDS */}
        <h2>6. COMPANY RECORDS AND VERIFICATION</h2>
        <div className="clause"><strong>6.1</strong> The Company may maintain operational records relating to: Partner login duration; availability; attendance; bookings; service completion; cancellations; customer feedback; service quality; payments; deductions; and other relevant operational matters.</div>
        <div className="clause"><strong>6.2</strong> The Company may verify Partner compliance through legitimate operational records, including: login records; GPS/location records; attendance records; booking history; customer feedback; service reports; photographs or videos where applicable; quality inspection reports; and other legitimate records maintained in the ordinary course of business.</div>
        <div className="clause"><strong>6.3</strong> Such records may be used for: calculating Partner payments; determining eligibility for incentive schemes; reviewing customer complaints; monitoring service quality; and enforcing the terms of this Agreement.</div>

        {/* 7. CONFIDENTIALITY */}
        <h2>7. CONFIDENTIALITY AND CUSTOMER INFORMATION</h2>
        <div className="clause"><strong>7.1</strong> The Partner shall maintain strict confidentiality regarding: customer information; booking details; customer addresses; contact information; photographs; service-related information; Company processes; pricing; business information; and other confidential information accessed during service delivery.</div>
        <div className="clause"><strong>7.2</strong> The Partner shall use customer information only for legitimate service delivery and operational purposes authorized by the Company.</div>
        <div className="clause"><strong>7.3</strong> The Partner shall not copy, store, disclose, misuse, sell, transfer, or share customer information with any unauthorized person or third party.</div>
        <div className="clause"><strong>7.4</strong> Unauthorized use, disclosure, or misuse of customer information may result in suspension, termination, and/or legal action subject to applicable law.</div>

        {/* 8. INDEPENDENT */}
        <h2>8. INDEPENDENT SERVICE PARTNER RELATIONSHIP</h2>
        <div className="clause"><strong>8.1</strong> The Partner acknowledges that the Partner is engaged as an independent Service Partner and that this Agreement does not, by itself, create an employer-employee relationship, partnership, joint venture, or other relationship except as expressly stated herein.</div>
        <div className="clause"><strong>8.2</strong> The Partner shall be responsible for complying with applicable laws, registrations, taxes, and statutory obligations applicable to the Partner's independent activities, to the extent legally applicable.</div>
        <div className="clause"><strong>8.3</strong> Nothing in this Agreement shall be construed as creating an employer-employee relationship between the Company and the Partner unless such relationship is expressly established by applicable law or a separate written agreement.</div>

        {/* 9. SUSPENSION */}
        <h2>9. SUSPENSION, RESTRICTION AND TERMINATION</h2>
        <div className="clause"><strong>9.1</strong> The Company may suspend, restrict, or temporarily block the Partner's access to bookings or the Partner platform where reasonably required due to: operational concerns; customer complaints; quality issues; non-availability; repeated cancellations; safety concerns; policy violations; or other legitimate reasons.</div>
        <div className="clause"><strong>9.2</strong> The Company may terminate this Agreement in accordance with its terms and applicable law in the event of: material breach; repeated operational violations; serious misconduct; fraud; unauthorized use of customer information; misuse of Company property; use of unauthorized chemicals or products; or other serious violations.</div>
        <div className="clause"><strong>9.3</strong> The Partner may discontinue the relationship by providing notice in accordance with the Company's applicable procedures and subject to completion or proper handover of accepted bookings and settlement of legitimate outstanding obligations.</div>
        <div className="clause"><strong>9.4</strong> Termination shall not affect any rights or obligations accrued before the effective date of termination.</div>
        <div className="clause"><strong>9.5</strong> The detailed account unblocking and reactivation procedure is provided in <strong>Annexure–A</strong>.</div>

        {/* 10. CHANGES */}
        <h2>10. CHANGES TO POLICIES AND COMMERCIAL TERMS</h2>
        <div className="clause"><strong>10.1</strong> The Company may revise its SOPs, service procedures, safety requirements, Partner Kit specifications, Partner Price Per Session, chemical rates, consumable prices, or other applicable commercial and operational terms based on legitimate business requirements, service scope, market conditions, supplier costs, safety requirements, or operational needs.</div>
        <div className="clause"><strong>10.2</strong> The Company shall inform the Partner in advance of material changes to applicable commercial terms wherever reasonably practicable.</div>
        <div className="clause"><strong>10.3</strong> Any revised rates or terms shall become applicable from the effective date communicated by the Company.</div>
        <div className="clause"><strong>10.4</strong> The Company may communicate revised rates, policies, or operational requirements through: Partner App; Partner Portal; WhatsApp; SMS; Email; Written communication; or any other official communication channel.</div>
        <div className="clause"><strong>10.5</strong> The latest approved rate card, SOP, or policy communicated by the Company shall supersede the previous applicable version from its effective date.</div>

        {/* 11. GOVERNING LAW */}
        <h2>11. GOVERNING LAW AND JURISDICTION</h2>
        <div className="clause"><strong>11.1</strong> This Agreement shall be governed by and construed in accordance with the laws of India.</div>
        <div className="clause"><strong>11.2</strong> Subject to applicable law, any dispute arising out of or in connection with this Agreement shall be subject to the exclusive jurisdiction of the competent courts at Hyderabad, Telangana.</div>

        {/* 12. ENTIRE */}
        <h2>12. ENTIRE AGREEMENT</h2>
        <div className="clause"><strong>12.1</strong> This Agreement, together with <strong>Annexure–A, Annexure–B, and Annexure–C</strong>, constitutes the entire agreement between the Company and the Partner concerning the subject matter hereof and supersedes any prior oral or written understanding relating to the same subject matter, to the extent legally permissible.</div>
        <div className="clause"><strong>12.2</strong> The Annexures attached to this Agreement shall form an integral part of this Agreement.</div>
        <div className="clause"><strong>12.3</strong> Any amendment or modification to this Agreement shall be made in writing or communicated through an official Company communication channel, subject to applicable law.</div>

        {/* PARTNER ACKNOWLEDGMENT */}
        <h2>PARTNER ACKNOWLEDGMENT AND DIGITAL ACCEPTANCE</h2>
        <p>I confirm that I have read, understood, and agreed to the Service Partner Agreement entered into between <strong>THE NEATIFY TEAM (OPC) PRIVATE LIMITED</strong> and me as the Service Partner.</p>
        <p>I further confirm that I understand and agree to comply with all applicable terms and conditions relating to: Partner Kit; Minimum Earnings Guarantee Scheme; service quality standards; customer confidentiality requirements; Partner Price and payment conditions; chemicals and consumables; operational guidelines; and all other applicable terms and conditions contained in this Agreement and its Annexures.</p>
        <p>I acknowledge that <strong>Annexure–A, Annexure–B, and Annexure–C</strong> form an integral part of this Agreement.</p>

        <div className="info-card" style={{ background: '#f8fcff', padding: '1rem 1.5rem', borderRadius: '20px', margin: '1.2rem 0' }}>
          <p><strong>PARTNER DETAILS</strong><br />
            Partner Name: <input type="text" className="dotted-field" /><br />
            Partner ID (OPTIONAL): <input type="text" className="dotted-field" /><br />
            Mobile Number: <input type="text" className="dotted-field" /><br />
            Partner Address: <input type="text" className="dotted-field" /></p>
        </div>

        <h3>PARTNER DIGITAL ACCEPTANCE THROUGH OTP VERIFICATION</h3>
        <p>The Partner agrees that this Service Partner Agreement may be accepted through the Company's approved online onboarding process using OTP verification.</p>
        <p>The OTP required for digital acceptance shall be sent to the Partner through the Company's registered WhatsApp communication number: <strong>Company Registered WhatsApp Number: 9247542051</strong></p>
        <p>The Partner's successful OTP verification shall constitute valid confirmation that the Partner:</p>
        <ul>
          <li>Has received access to and reviewed this Agreement and all applicable Annexures;</li>
          <li>Has read and understood the terms and conditions contained herein;</li>
          <li>Accepts and agrees to comply with Company SOPs, service standards, operational requirements, pricing terms, payment conditions, confidentiality obligations, and other applicable policies.</li>
        </ul>
        <p>Upon successful OTP verification:</p>
        <ol>
          <li>The Partner's digital acceptance shall be recorded as confirmation of agreement to this Service Partner Agreement.</li>
          <li>The Company may complete internal approval procedures and apply the Company Representative signature and Company Seal/Stamp after verification.</li>
          <li>The digitally accepted Agreement shall be maintained as an electronic record by the Company.</li>
        </ol>

        <div className="info-card" style={{ background: '#eaf2f9', padding: '1.2rem 1.8rem', borderRadius: '20px', margin: '1.5rem 0' }}>
          <p><strong>PARTNER OTP ACCEPTANCE DETAILS</strong><br />
            Partner Name: <input type="text" className="dotted-field" /><br />
            Registered Mobile Number: <input type="text" className="dotted-field" /><br />
            OTP Sent Through WhatsApp Number: 9247542051<br />
            OTP Verification Date: <input type="date" className="dotted-field" /><br />
            Partner Digital Acceptance Status: <input type="text" className="dotted-field" /></p>
        </div>

        <div className="signature-block">
          <div className="signature-item"><span className="label">Company Representative</span><div className="value">Mandapuram Santosh</div><div className="value" style={{ borderBottom: 'none', fontWeight: 400 }}>Designation: Operations Manager</div></div>
          <div className="signature-item"><span className="label">Company Representative Signature</span><div className="value">(To be applied after successful Partner OTP acceptance and internal Company approval)</div><div className="value" style={{ borderBottom: 'none' }}>Date: <input type="date" className="dotted-field" /></div></div>
          <div className="signature-item"><span className="label">Company Seal / Stamp</span><div className="stamp-placeholder">(To be applied after completion of Partner OTP acceptance, verification, and internal approval by the Company)</div></div>
        </div>

        <hr />
        <p style={{ textAlign: 'center', fontWeight: 300, fontSize: '1.1rem' }}>END OF MAIN SERVICE PARTNER AGREEMENT</p>

        {/* ========== ANNEXURE A ========== */}
        <div className="annex-box">
          <h2 style={{ borderBottom: 'none', marginTop: 0 }}>ANNEXURE – A</h2>
          <h3>PARTNER KIT, EQUIPMENT &amp; OPERATIONAL TERMS</h3>
          <p><em>This Annexure–A forms an integral part of the Service Partner Agreement entered into between <strong>THE NEATIFY TEAM (OPC) PRIVATE LIMITED</strong> and <strong>The Service Partner</strong>.</em></p>

          <h4>1. PARTNER KIT PRICE, PAYMENT AND EXISTING KIT ADJUSTMENT</h4>
          <div className="clause"><strong>1.1</strong> The Partner shall purchase the applicable <strong>The Neatify Team Partner Kit</strong> required for the service category for which the Partner is approved or engaged by the Company before commencing or continuing service operations.</div>
          <div className="clause"><strong>1.2</strong> The applicable Partner Kit prices shall be as follows:</div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>S. No.</th><th>Partner Kit Type</th><th>Base Price</th></tr></thead>
              <tbody>
                <tr><td>1</td><td>Bathroom Cleaning Kit</td><td>₹10,000</td></tr>
                <tr><td>2</td><td>Sofa Cleaning Kit</td><td>₹12,000</td></tr>
                <tr><td>3</td><td>Deep Cleaning Kit</td><td>₹15,000</td></tr>
              </tbody>
            </table>
          </div>
          <div className="clause"><strong>1.3</strong> The above Partner Kit prices are exclusive of applicable Goods and Services Tax (GST). Applicable GST and any other statutory taxes, duties, or government levies shall be charged additionally at the prevailing rate applicable on the date of purchase or invoicing.</div>
          <div className="clause"><strong>1.4</strong> The final amount payable by the Partner shall be: <strong>Applicable Partner Kit Base Price + Applicable GST + Other Statutory Charges (if applicable).</strong></div>
          <div className="clause"><strong>1.5</strong> The Partner Kit amount shall be paid by the Partner through the payment method approved by the Company.</div>
          <div className="clause"><strong>1.6</strong> The Company may provide different Partner Kit categories or configurations depending on: service category; type of work assigned; equipment requirements; and operational standards.</div>
          <div className="clause"><strong>1.7</strong> If the Partner already possesses any previously purchased Partner Kit, equipment, tools, or materials issued or purchased from the Company, the Partner must present the same to the Company for physical inspection and verification before purchasing a new or additional Partner Kit.</div>
          <div className="clause"><strong>1.8</strong> The Company shall inspect and verify: Condition; Completeness; Usability; Age; Safety; and Suitability of the existing Partner Kit or equipment. Based on such inspection, the Company may determine an eligible adjustment value.</div>
          <div className="clause"><strong>1.9–1.15</strong> (Adjustment, exclusion, final determination, revision terms) … see full text in original document.</div>
          <div className="clause"><strong>1.16</strong> Where a Partner is approved for multiple service categories, the Company may require the Partner to purchase corresponding Partner Kits for each service category, subject to approved adjustments.</div>

          <h4>2. PARTNER KIT – ITEM LIST</h4>
          <h5>2.1 BATHROOM CLEANING KIT</h5>
          <div className="table-wrap">
            <table>
              <thead><tr><th>S. No.</th><th>Item Name</th><th>Quantity</th></tr></thead>
              <tbody>
                <tr><td>1</td><td>Bag</td><td>1</td></tr>
                <tr><td>2</td><td>T-Shirt</td><td>2</td></tr>
                <tr><td>3</td><td>Caps</td><td>2</td></tr>
                <tr><td>4</td><td>Samosa Scraper</td><td>1</td></tr>
                <tr><td>5</td><td>Green Scrubber</td><td>1</td></tr>
                <tr><td>6</td><td>Steel Scrubber</td><td>1</td></tr>
                <tr><td>7</td><td>Glass Wiper</td><td>1</td></tr>
                <tr><td>8</td><td>Commode Brush</td><td>1</td></tr>
                <tr><td>9</td><td>PR6 Chemical</td><td>1 Litre</td></tr>
                <tr><td>10</td><td>PR1 Chemical</td><td>1 Litre</td></tr>
                <tr><td>11</td><td>Room Freshener</td><td>1</td></tr>
                <tr><td>12</td><td>Glass Cleaner</td><td>1</td></tr>
                <tr><td>13</td><td>Summa Multi</td><td>1 Litre</td></tr>
                <tr><td>14</td><td>Sandpaper</td><td>5</td></tr>
                <tr><td>15</td><td>Putty Blade</td><td>2</td></tr>
                <tr><td>16</td><td>Gloves</td><td>1 Set</td></tr>
                <tr><td>17</td><td>Yellow Cloths</td><td>2</td></tr>
                <tr><td>18</td><td>Spray Bottles</td><td>2</td></tr>
                <tr><td>19</td><td>PVC Seat</td><td>1</td></tr>
                <tr><td>20</td><td>Small Dustbin Cover</td><td>1</td></tr>
                <tr><td>21</td><td>Scrubbing Machine + Fittings / Accessories</td><td>1 Set</td></tr>
              </tbody>
            </table>
          </div>
          <p><strong>Bathroom Cleaning Kit Pricing</strong><br />
            • Bathroom Cleaning Kit with Hand Scrubbing Machine: ₹10,000<br />
            • Bathroom Cleaning Kit without Hand Scrubbing Machine — Partner to Bring Own Equipment: ₹5,000<br />
            <span className="small-meta">* Prices exclusive of GST and statutory charges.</span></p>

          <h5>2.2 SOFA CLEANING KIT</h5>
          <div className="table-wrap">
            <table>
              <thead><tr><th>S. No.</th><th>Item Name</th><th>Quantity</th></tr></thead>
              <tbody>
                <tr><td>1</td><td>Vacuum Machine + Fittings / Accessories</td><td>1 Set</td></tr>
                <tr><td>2</td><td>103 Chemical</td><td>As applicable</td></tr>
                <tr><td>3</td><td>101 Chemical</td><td>As applicable</td></tr>
                <tr><td>4</td><td>Foam Bottles</td><td>As applicable</td></tr>
                <tr><td>5</td><td>Big Bag</td><td>1</td></tr>
                <tr><td>6</td><td>T-Shirts</td><td>2</td></tr>
                <tr><td>7</td><td>Caps</td><td>2</td></tr>
                <tr><td>8</td><td>Gloves</td><td>1 Set</td></tr>
              </tbody>
            </table>
          </div>
          <p><strong>Sofa Cleaning Kit Pricing</strong><br />
            • Sofa Cleaning Kit with Extraction Machine: ₹12,000<br />
            • Sofa Cleaning Kit without Extraction Machine — Partner to Bring Own Equipment: ₹6,000</p>

          <h5>2.3 DEEP CLEANING KIT</h5>
          <p>The Deep Cleaning Kit shall be applicable to Partners approved for Deep Cleaning Services. The Company shall specify the detailed item list and equipment configuration applicable to the Deep Cleaning Kit based on service requirements and operational standards.</p>
          <p><strong>Deep Cleaning Kit Base Price: ₹15,000</strong> (exclusive of applicable GST and other statutory charges, if any.)</p>

          <h5>2.4 KIT CONTENTS, EQUIPMENT AND PRICING CONDITIONS</h5>
          <div className="clause"><strong>2.4.1</strong> The Partner Kit price applicable to the Partner shall depend on: Kit category; Service requirement; and whether the specified machine or equipment is included in the kit configuration.</div>
          <div className="clause"><strong>2.4.2</strong> The applicable Partner Kit Base Price is exclusive of GST. Applicable GST and other statutory charges shall be charged additionally.</div>
          <div className="clause"><strong>2.4.3</strong> The Company may inspect and verify the Partner Kit and its contents at reasonable times to ensure compliance with: Company standards; Safety requirements; and Service quality expectations.</div>
          <div className="clause"><strong>2.4.4–2.4.5</strong> (Maintenance, modification terms) … see full text.</div>

          <h4>3. UNBLOCKING / RE-ACTIVATION TERMS</h4>
          <div className="clause"><strong>3.1</strong> If the Partner's account is blocked, suspended, or restricted due to: cancellation; non-availability; failure to attend bookings; customer complaints; quality issues; or violation of Company policies, the Partner shall not be entitled to automatic reactivation.</div>
          <div className="clause"><strong>3.2</strong> Before the Partner account is unblocked or reactivated, the Company may require the Partner to: contact the Company or attend a counselling/review session; provide a valid explanation; complete corrective action, training, or quality assessment; clear outstanding amounts or approved recovery amounts, where applicable; confirm future compliance with Company SOPs and booking requirements; and obtain approval from an authorized Company representative.</div>
          <div className="clause"><strong>3.3</strong> The Company may consider the Partner's: previous performance; cancellation history; customer complaints; service quality; attendance; and compliance record before approving reactivation.</div>
          <div className="clause"><strong>3.4</strong> Reactivation shall be subject to Company approval and shall not create any automatic right to receive bookings or Minimum Earnings Guarantee benefits unless all applicable eligibility requirements are satisfied.</div>

          <h4>4. EQUIPMENT MAINTENANCE AND REPLACEMENT</h4>
          <div className="clause"><strong>4.1</strong> The Partner shall maintain all Partner Kit equipment in proper working condition.</div>
          <div className="clause"><strong>4.2</strong> Any equipment damaged due to: negligence; misuse; unauthorized modification; or improper handling shall be repaired or replaced by the Partner at the Partner's own cost unless otherwise approved by the Company.</div>
          <div className="clause"><strong>4.3</strong> The Partner shall not sell, transfer, lend, lease, or permanently hand over Company-branded equipment or materials to any third party without prior written approval.</div>
          <div className="clause"><strong>4.4</strong> The Partner shall immediately inform the Company if any essential equipment becomes: damaged; lost; unsafe; or unusable.</div>
          <p style={{ textAlign: 'right', marginTop: '0.8rem' }}><strong>END OF ANNEXURE – A</strong></p>
        </div>

        {/* ========== ANNEXURE B ========== */}
        <div className="annex-box">
          <h2 style={{ borderBottom: 'none', marginTop: 0 }}>ANNEXURE – B</h2>
          <h3>PARTNER PRICE PER SESSION, CHEMICALS &amp; CONSUMABLES RATE CARD</h3>
          <p><em>This Annexure–B forms an integral part of the Service Partner Agreement entered into between <strong>THE NEATIFY TEAM (OPC) PRIVATE LIMITED</strong> and <strong>The Service Partner</strong>.</em></p>
          <p>The following rates shall apply as the Partner Price Per Session for successfully completed and verified service bookings, subject to the terms and conditions of the Service Partner Agreement.</p>

          <h4>1. BATHROOM CLEANING SERVICES</h4>
          <div className="table-wrap">
            <table><thead><tr><th>S. No.</th><th>Service Title</th><th>Partner Price Per Session</th></tr></thead>
              <tbody>
                <tr><td>1</td><td>Super Neatify 1 Bathroom</td><td>₹300</td></tr>
                <tr><td>2</td><td>Super Neatify 2 Bathrooms</td><td>₹600</td></tr>
                <tr><td>3</td><td>Super Neatify 3 Bathrooms</td><td>₹900</td></tr>
                <tr><td>4</td><td>Super Neatify 4 Bathrooms</td><td>₹1,200</td></tr>
                <tr><td>5</td><td>Neatify 1 Move-In Bathroom</td><td>₹330</td></tr>
                <tr><td>6</td><td>Neatify 2 Move-In Bathrooms</td><td>₹660</td></tr>
                <tr><td>7</td><td>Neatify 3 Move-In Bathrooms</td><td>₹990</td></tr>
                <tr><td>8</td><td>Neatify 4 Move-In Bathrooms</td><td>₹1,320</td></tr>
              </tbody></table>
          </div>

          <h4>2. KITCHEN SERVICES</h4>
          <div className="table-wrap"><table><thead><tr><th>S. No.</th><th>Service Title</th><th>Partner Price Per Session</th></tr></thead>
            <tbody>
              <tr><td>1</td><td>Neatify Kitchen + Stove</td><td>₹1,000</td></tr>
              <tr><td>2</td><td>Neatify Kitchen + Stove + Chimney</td><td>₹1,300</td></tr>
              <tr><td>3</td><td>Neatify Kitchen + Stove + Chimney + Fridge</td><td>₹1,500</td></tr>
              <tr><td>4</td><td>Neatify Move-In Kitchen</td><td>₹1,200</td></tr>
              <tr><td>5</td><td>Chimney Cleaning</td><td>₹300</td></tr>
              <tr><td>6</td><td>Fridge Cleaning – Single Door</td><td>₹209</td></tr>
              <tr><td>7</td><td>Fridge Cleaning – Double Door (Two Door Side-by-Side)</td><td>₹309</td></tr>
              <tr><td>8</td><td>Utensils Removal and Replacement</td><td>₹409</td></tr>
            </tbody></table>
          </div>

          <h4>3. SOFA CLEANING SERVICES</h4>
          <div className="table-wrap"><table><thead><tr><th>S. No.</th><th>Service Title</th><th>Partner Price Per Session</th></tr></thead>
            <tbody>
              <tr><td>1</td><td>Neatify Sofa – 1 to 3 Seaters</td><td>₹399</td></tr>
              <tr><td>2</td><td>Neatify Sofa – 3 to 5 Seaters</td><td>₹499</td></tr>
              <tr><td>3</td><td>Neatify Sofa – 6 to 8 Seaters</td><td>₹599</td></tr>
              <tr><td>4</td><td>Neatify Sofa – 9 to 10 Seaters</td><td>₹699</td></tr>
            </tbody></table>
          </div>

          <h4>4. EXPRESS DEEP CLEANING SERVICES</h4>
          <div className="table-wrap"><table><thead><tr><th>S. No.</th><th>Service Title</th><th>Partner Price Per Session</th></tr></thead>
            <tbody>
              <tr><td>1</td><td>Neatify Express Home Cleaning – 1 Bedroom Flat</td><td>₹1,600</td></tr>
              <tr><td>2</td><td>Neatify Express Home Cleaning – 2 Bedroom Flat</td><td>₹2,000</td></tr>
              <tr><td>3</td><td>Neatify Express Home Cleaning – 3 Bedroom Flat</td><td>₹2,500</td></tr>
              <tr><td>4</td><td>Neatify Express Home Cleaning – 4 Bedroom Flat</td><td>₹3,000</td></tr>
            </tbody></table>
          </div>

          <h4>5. EXIT DEEP CLEANING SERVICES</h4>
          <div className="table-wrap"><table><thead><tr><th>S. No.</th><th>Service Title</th><th>Partner Price Per Session</th></tr></thead>
            <tbody>
              <tr><td>1</td><td>Neatify Home Exit Deep Clean – 1 Bedroom Flat</td><td>₹2,200</td></tr>
              <tr><td>2</td><td>Neatify Home Exit Deep Clean – 2 Bedroom Flat</td><td>₹2,600</td></tr>
              <tr><td>3</td><td>Neatify Home Exit Deep Clean – 3 Bedroom Flat</td><td>₹3,000</td></tr>
              <tr><td>4</td><td>Neatify Home Exit Deep Clean – 4 Bedroom Flat</td><td>₹3,800</td></tr>
            </tbody></table>
          </div>

          <h4>6. MOVE-IN DEEP CLEANING SERVICES</h4>
          <div className="table-wrap"><table><thead><tr><th>S. No.</th><th>Service Title</th><th>Partner Price Per Session</th></tr></thead>
            <tbody>
              <tr><td>1</td><td>Neatify New Move-In Deep Clean – 1 Bedroom Flat</td><td>₹3,600</td></tr>
              <tr><td>2</td><td>Neatify New Move-In Deep Clean – 2 Bedroom Flat</td><td>₹4,300</td></tr>
              <tr><td>3</td><td>Neatify New Move-In Deep Clean – 2.5 Bedroom Flat</td><td>₹4,800</td></tr>
              <tr><td>4</td><td>Neatify New Move-In Deep Clean – 3 Bedroom Flat</td><td>₹5,300</td></tr>
              <tr><td>5</td><td>Neatify New Move-In Deep Clean – 4 Bedroom Flat</td><td>₹7,000</td></tr>
            </tbody></table>
          </div>

          <h4>7. FURNISHED DEEP CLEANING SERVICES</h4>
          <div className="table-wrap"><table><thead><tr><th>S. No.</th><th>Service Title</th><th>Partner Price Per Session</th></tr></thead>
            <tbody>
              <tr><td>1</td><td>Neatify Furnished Home Deep Clean – 1 Bedroom Flat</td><td>₹2,900</td></tr>
              <tr><td>2</td><td>Neatify Furnished Home Deep Clean – 2 Bedroom Flat</td><td>₹3,600</td></tr>
              <tr><td>3</td><td>Neatify Furnished Home Deep Clean – 3 Bedroom Flat</td><td>₹4,600</td></tr>
              <tr><td>4</td><td>Neatify Furnished Home Deep Clean – 4 Bedroom Flat</td><td>₹5,400</td></tr>
            </tbody></table>
          </div>

          <h4>8. PARTNER PRICE TERMS AND CONDITIONS</h4>
          <div className="clause"><strong>8.1–8.6</strong> (Determination, completion, deductions, add-on services, negotiation) … see full text.</div>

          <h4>9. CHEMICALS &amp; CONSUMABLES RATE CARD</h4>
          <div className="table-wrap">
            <table><thead><tr><th>S. No.</th><th>Name</th><th>Unit</th><th>Rate</th></tr></thead>
              <tbody>
                <tr><td>1</td><td>PR6 Chemical</td><td>1 Liter</td><td>₹130</td></tr>
                <tr><td>2</td><td>PR1 Chemical</td><td>1 Liter</td><td>₹160</td></tr>
                <tr><td>3</td><td>Room Freshener</td><td>1 No.</td><td>₹120</td></tr>
                <tr><td>4</td><td>Glass Cleaner</td><td>1 No.</td><td>₹120</td></tr>
                <tr><td>5</td><td>Floor Cleaner PR7</td><td>1 Liter</td><td>₹130</td></tr>
              </tbody></table>
          </div>
          <div className="clause"><strong>9.1–9.3</strong> (Rate applicability, recovery, usage) … </div>
          <h4>10. CHANGES TO PARTNER PRICE, CHEMICAL RATES AND POLICIES</h4>
          <div className="clause"><strong>10.1–10.5</strong> (Revision, communication, superseding) … </div>
          <h4>11. PARTNER PAYMENT CONDITIONS</h4>
          <div className="clause"><strong>11.1–11.4</strong> (Calculation, deductions, investigation, final payable amount) … </div>
          <p style={{ textAlign: 'right' }}><strong>END OF ANNEXURE – B</strong></p>
        </div>

        {/* ========== ANNEXURE C ========== */}
        <div className="annex-box">
          <h2 style={{ borderBottom: 'none', marginTop: 0 }}>ANNEXURE – C</h2>
          <h3>PARTNER KIT PAYMENT, MACHINE ADJUSTMENT &amp; INSTALLMENT TERMS</h3>
          <p><em>This Annexure–C forms an integral part of the Service Partner Agreement entered into between <strong>THE NEATIFY TEAM (OPC) PRIVATE LIMITED</strong> and <strong>The Service Partner</strong>.</em></p>
          <h4>1. PURPOSE</h4>
          <div className="clause"><strong>1.1</strong> This Annexure sets out the terms governing: Partner Kit purchase; Existing machine inspection and adjustment; Complete Partner Kit purchase; Payment recovery; and Weekly installment arrangements.</div>
          <h4>2. EXISTING MACHINE INSPECTION &amp; ADJUSTMENT</h4>
          <div className="clause"><strong>2.1</strong> If the Partner already owns a compatible cleaning machine or equipment, the same must be produced at the Company's office for physical inspection and verification.</div>
          <div className="clause"><strong>2.2</strong> The Company shall inspect the machine based on: Condition; Working performance; Age; Safety; Usability; Compatibility with Company service requirements.</div>
          <div className="clause"><strong>2.3</strong> If approved by the Company, the verified machine value may be adjusted against the applicable Partner Kit price.</div>
          <div className="clause"><strong>2.4</strong> The Partner shall pay only the remaining balance amount after adjustment.</div>
          <div className="clause"><strong>2.5–2.6</strong> (Company decision final; no adjustment without physical presentation) …</div>
          <h4>3. COMPLETE PARTNER KIT PURCHASE</h4>
          <div className="clause"><strong>3.1</strong> Where the Partner purchases the complete Partner Kit including the required machine or equipment, the outstanding payable amount may be recovered through weekly installments as approved by the Company.</div>
          <div className="clause"><strong>3.2</strong> The applicable Partner Kit amount shall be calculated after considering: Kit category; Equipment included; Applicable GST; Approved adjustments, if any; and Other applicable charges.</div>
          <h4>4. WEEKLY INSTALLMENTS</h4>
          <div className="clause"><strong>4.1</strong> The outstanding Partner Kit amount shall be divided into <strong>six (6) equal weekly installments</strong>, unless otherwise agreed by the Company.</div>
          <div className="clause"><strong>4.2</strong> The Partner authorizes the Company to deduct the applicable weekly installment amount from the Partner's weekly payout until the complete outstanding amount is recovered.</div>
          <div className="clause"><strong>4.3</strong> The Partner agrees that such deductions are authorized for recovery of the approved Partner Kit purchase amount.</div>
          <div className="clause"><strong>4.4</strong> If any outstanding balance remains due after: Resignation; Termination; Suspension; or Discontinuation of services, the remaining amount shall become immediately payable by the Partner to the Company.</div>
          <h4>5. AUTHORIZATION</h4>
          <div className="clause"><strong>5.1</strong> The Partner voluntarily authorizes <strong>THE NEATIFY TEAM (OPC) PRIVATE LIMITED</strong> to recover the approved Partner Kit outstanding amount through weekly payout deductions.</div>
          <div className="clause"><strong>5.2</strong> The Partner confirms that: The installment terms have been explained; The Partner understands the payment obligation; The Partner accepts the deduction mechanism.</div>

          <div className="info-card" style={{ background: '#f2f8fd', padding: '1rem 1.5rem', borderRadius: '18px', margin: '1.2rem 0' }}>
            <p><strong>PARTNER DETAILS</strong><br />
              Partner Name: <input type="text" className="dotted-field" /><br />
              Partner ID: <input type="text" className="dotted-field" /><br />
              Mobile Number: <input type="text" className="dotted-field" /></p>
          </div>

          <p><strong>PARTNER ACCEPTANCE</strong><br />
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '10px' }}>
              <input type="checkbox" style={{ width: '18px', height: '18px', cursor: 'pointer' }} data-html2canvas-ignore="true" />
              <span style={{ flex: 1 }}>I confirm that I have understood and accepted the Partner Kit Payment, Machine Adjustment and Installment Terms mentioned in this Annexure–C.</span>
            </label>
          </p>

          {/* Signature Module */}
          <div className="signature-module">
            <h4>Partner Signature / Digital Acceptance</h4>
            <div className="signature-box" style={{ background: '#fff', border: '2px dashed #999', borderRadius: 10, marginTop: 15, overflow: 'hidden' }} data-html2canvas-ignore="true">
              <SignatureCanvas
                ref={sigCanvas}
                penColor="black"
                canvasProps={{
                  style: {
                    width: '100%',
                    height: '150px',
                    touchAction: 'none'
                  }
                }}
              />
            </div>
            <div className="signature-buttons" style={{ display: 'flex', gap: 15, marginTop: 20 }} data-html2canvas-ignore="true">
              <button type="button" onClick={clearSignature} className="btn btn-clear" style={{ padding: '12px 22px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Clear</button>
              <button type="button" onClick={saveSignature} className="btn btn-save" style={{ padding: '12px 22px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Save Signature</button>
            </div>
            {signature && (
              <div className="signature-preview-container" style={{ marginTop: '1.5rem' }}>
                <h4>Signature Preview</h4>
                <img src={signature} alt="Signature Preview" className="signature-preview" style={{ border: '1px solid #ddd', background: '#fff', borderRadius: 8, maxWidth: '100%' }} />
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '2rem', marginTop: '1rem' }}>
            <span>Date: <input type="date" className="dotted-field" /></span>
            <span>Time: <input type="time" className="dotted-field" /></span>
          </div>

          <p style={{ textAlign: 'right' }}><strong>END OF ANNEXURE – C</strong></p>
        </div>

        {/* final footer */}
        <div style={{ pageBreakInside: 'avoid' }}>
          <hr />
          <p style={{ textAlign: 'center', fontWeight: 400, fontSize: '1rem' }}>END OF SERVICE PARTNER AGREEMENT</p>
          <p style={{ textAlign: 'center', fontWeight: 300, color: '#1f4a5e', marginTop: '0.2rem' }}><strong>THE NEATIFY TEAM (OPC) PRIVATE LIMITED</strong><br />
            Registered / Corporate Office: 4th Floor, Door No. 1-4A, 1-4B, Serilingampally, Nallagandla Road, Gopanpalle, Hyderabad, Telangana – 500046</p>
          <div style={{ height: '4px' }}></div>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: '2rem', marginBottom: '2rem' }}>
        <button
          type="button"
          onClick={handleDownloadPdf}
          style={{ padding: '14px 28px', background: '#0b2b3b', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: '1.1rem', fontWeight: 600, boxShadow: '0 4px 12px rgba(11, 43, 59, 0.2)' }}
        >
          Download as PDF
        </button>
      </div>
    </>
  );
}
