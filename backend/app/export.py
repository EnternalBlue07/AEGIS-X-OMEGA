import io
import datetime
from typing import Dict, List, Any, Optional

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas

from docx import Document
from docx.shared import Inches, Pt
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

from pptx import Presentation
from pptx.util import Inches as PtInches, Pt as PtSize
from pptx.enum.text import PP_ALIGN

# AEGIS-X Color Palette Tokens
HEX_INK_BASE = "#10141C"
HEX_PAPER = "#EDE9DF"
HEX_EVIDENCE_GOLD = "#C99B4D"
HEX_LEDGER_BLUE = "#5C82A6"
HEX_ALERT_RUST = "#B8503D"

COLOR_INK_BASE = colors.HexColor(HEX_INK_BASE)
COLOR_PAPER = colors.HexColor(HEX_PAPER)
COLOR_EVIDENCE_GOLD = colors.HexColor(HEX_EVIDENCE_GOLD)
COLOR_LEDGER_BLUE = colors.HexColor(HEX_LEDGER_BLUE)
COLOR_ALERT_RUST = colors.HexColor(HEX_ALERT_RUST)

class NumberedCanvas(canvas.Canvas):
    """
    Canvas to draw the rotated DRAFT watermark and footer page numbering.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_elements(num_pages)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def draw_elements(self, page_count):
        self.saveState()
        
        # 1. Rotated Watermark
        self.setFont("Helvetica-Bold", 36)
        self.setFillColor(COLOR_ALERT_RUST, alpha=0.08)
        self.translate(300, 400)
        self.rotate(35)
        self.drawCentredString(0, 0, "DRAFT — FOR DEMONSTRATION ONLY")
        self.restoreState()

        # 2. Header and Footer border lines
        self.saveState()
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(COLOR_LEDGER_BLUE)
        self.drawString(54, 755, "AEGIS-X // AUTONOMOUS FINANCIAL CRIME OS")
        self.drawRightString(612 - 54, 755, datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S UTC"))
        
        self.setStrokeColor(COLOR_LEDGER_BLUE)
        self.setLineWidth(0.5)
        self.line(54, 747, 612 - 54, 747)
        
        self.line(54, 45, 612 - 54, 45)
        self.setFont("Helvetica", 8)
        self.drawString(54, 30, "CLASSIFICATION: PORTFOLIO GRADE / PRE-SEED DEMO")
        self.drawRightString(612 - 54, 30, f"Page {self._pageNumber} of {page_count}")
        self.restoreState()


def generate_pdf(
    alert: Any, 
    account: Optional[Any], 
    user: Optional[Any], 
    txn: Optional[Any], 
    investigation: Dict[str, Any], 
    timeline: List[Dict[str, Any]]
) -> bytes:
    """
    Generates a beautifully styled ReportLab PDF.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=72,
        bottomMargin=72
    )

    styles = getSampleStyleSheet()
    
    # Custom Typography Styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=COLOR_INK_BASE,
        spaceAfter=15,
        alignment=0 # Left
    )
    
    section_heading = ParagraphStyle(
        'SectionHeading',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        textColor=COLOR_LEDGER_BLUE,
        spaceBefore=15,
        spaceAfter=6,
        borderPadding=(0, 0, 2, 0),
        borderColor=COLOR_LEDGER_BLUE
    )

    body_style = ParagraphStyle(
        'BodyText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=COLOR_INK_BASE,
        spaceAfter=8
    )

    mono_style = ParagraphStyle(
        'MonoText',
        parent=styles['Code'],
        fontName='Courier',
        fontSize=8,
        leading=10,
        textColor=COLOR_INK_BASE
    )

    stamp_style = ParagraphStyle(
        'StampStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=14,
        textColor=COLOR_ALERT_RUST,
        spaceAfter=15
    )

    story = []

    # 1. Rotated Tilted Stamp element in the report header
    story.append(Paragraph("STATUS: UNDER INVESTIGATION // DRAFT REPORT", stamp_style))
    story.append(Paragraph("AEGIS-X CASE FILE REPORT", title_style))
    
    # 2. Case Metadata Table
    meta_data = [
        [Paragraph("<b>Case / Alert ID:</b>", body_style), Paragraph(alert.id, mono_style), 
         Paragraph("<b>Trigger Event:</b>", body_style), Paragraph(alert.triggered_by.replace('_', ' '), body_style)],
        [Paragraph("<b>Target Entity ID:</b>", body_style), Paragraph(alert.entity_id, mono_style),
         Paragraph("<b>Risk Severity:</b>", body_style), Paragraph(alert.severity, body_style)],
        [Paragraph("<b>Calibration Score:</b>", body_style), Paragraph(f"<b>{(investigation['composite_score'] * 100):.1f}%</b>", body_style),
         Paragraph("<b>Model Version:</b>", body_style), Paragraph(investigation.get('model_version', 'N/A'), mono_style)],
    ]
    
    meta_table = Table(meta_data, colWidths=[110, 140, 110, 144])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), COLOR_PAPER),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#C99B4D")),
        ('BOX', (0, 0), (-1, -1), 1.0, COLOR_INK_BASE),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 15))

    # 3. Suspicious Activity Narrative
    story.append(Paragraph("EXECUTIVE NARRATIVE", section_heading))
    narrative_text = investigation.get('case_report', {}).get('suspicious_activity_narrative', 'No narrative compiled.')
    story.append(Paragraph(narrative_text, body_style))
    
    # 4. Citations
    story.append(Paragraph("REGULATORY & EVIDENCE CITATIONS", section_heading))
    citations = investigation.get('case_report', {}).get('evidence_citations', [])
    cit_text = ""
    for idx, cit in enumerate(citations):
        cit_text += f"<b>[{idx+1}] {cit['source']}:</b> {cit['fact']}<br/>"
    
    regulations = investigation.get('case_report', {}).get('regulatory_citations', [])
    for reg in regulations:
        cit_text += f"• <b>Compliance Citation:</b> {reg}<br/>"
        
    story.append(Paragraph(cit_text if cit_text else "No citations linked.", body_style))
    story.append(Spacer(1, 10))

    # 5. Multi-Agent Swarm Debate (keep it together if possible)
    debate_flowables = [Paragraph("L7 SWARM DEBATE TRANSCRIPT LOGS", section_heading)]
    debate_logs = investigation.get('debate_transcript', [])
    
    for msg in debate_logs:
        agent_header = f"<b>{msg['agent'].upper()}</b> ({msg.get('status', 'COMPLETED')})"
        agent_msg = msg['message']
        text = f"{agent_header}:<br/>{agent_msg}"
        if 'tool_calls' in msg and msg['tool_calls']:
            text += f"<br/><i>Tools invoked: {', '.join(msg['tool_calls'])}</i>"
            
        p = Paragraph(text, ParagraphStyle(
            'DebateLog',
            parent=body_style,
            fontSize=8,
            leading=10,
            textColor=COLOR_INK_BASE if not "AMLExpert" in msg['agent'] else COLOR_ALERT_RUST
        ))
        
        # Wrapped in a thin container table
        log_tbl = Table([[p]], colWidths=[504])
        log_tbl.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#F8F9FA") if not "AMLExpert" in msg['agent'] else colors.HexColor("#FFF0F0")),
            ('LINELEFT', (0, 0), (-1, -1), 2, COLOR_LEDGER_BLUE if not "AMLExpert" in msg['agent'] else COLOR_ALERT_RUST),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ]))
        debate_flowables.append(log_tbl)
        debate_flowables.append(Spacer(1, 4))
        
    story.append(KeepTogether(debate_flowables))
    story.append(Spacer(1, 10))

    # 6. Timeline Summary
    timeline_flowables = [Paragraph("CHRONOLOGICAL CHANNELS TIMELINE", section_heading)]
    timeline_data = [["Timestamp", "Event Title", "Details / Evidence"]]
    
    for ev in timeline[:8]: # Cap at 8 elements in PDF to keep pages reasonable
        ts_str = ev['timestamp'].replace('T', ' ').replace('Z', '')[:19]
        timeline_data.append([
            Paragraph(ts_str, mono_style),
            Paragraph(ev['title'], ParagraphStyle('EvTitle', parent=body_style, fontName='Helvetica-Bold', fontSize=8, leading=10)),
            Paragraph(ev['description'], ParagraphStyle('EvDesc', parent=body_style, fontSize=8, leading=10))
        ])
        
    time_table = Table(timeline_data, colWidths=[100, 140, 264])
    time_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), COLOR_LEDGER_BLUE),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('INNERGRID', (0, 0), (-1, -1), 0.3, colors.lightgrey),
        ('BOX', (0, 0), (-1, -1), 0.5, COLOR_INK_BASE),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    timeline_flowables.append(time_table)
    story.append(KeepTogether(timeline_flowables))

    doc.build(story, canvasmaker=NumberedCanvas)
    
    buffer.seek(0)
    return buffer.getvalue()


def generate_docx(
    alert: Any, 
    account: Optional[Any], 
    user: Optional[Any], 
    txn: Optional[Any], 
    investigation: Dict[str, Any], 
    timeline: List[Dict[str, Any]]
) -> bytes:
    """
    Generates a structured Word document report.
    """
    from docx.shared import RGBColor
    doc = Document()
    
    # Page setup
    sections = doc.sections
    for section in sections:
        section.top_margin = Inches(1)
        section.bottom_margin = Inches(1)
        section.left_margin = Inches(1)
        section.right_margin = Inches(1)

    # Styling helper for borders
    def set_cell_background(cell, color_hex):
        shading = OxmlElement('w:shd')
        shading.set(qn('w:val'), 'clear')
        shading.set(qn('w:color'), 'auto')
        shading.set(qn('w:fill'), color_hex)
        cell._tc.get_or_add_tcPr().append(shading)

    # Document Header
    p = doc.add_paragraph()
    r = p.add_run("AEGIS-X Autonomous Financial Crime Intel operating system\n")
    r.font.name = 'Courier New'
    r.font.size = Pt(8.5)
    r.font.color.rgb = RGBColor(92, 130, 166) # Ledger Blue
    
    title = doc.add_paragraph()
    title_run = title.add_run("SUSPICIOUS ACTIVITY INVESTIGATION CASE FILE")
    title_run.bold = True
    title_run.font.name = 'Arial'
    title_run.font.size = Pt(16)
    title_run.font.color.rgb = RGBColor(16, 20, 28) # Ink Base

    p_stamp = doc.add_paragraph()
    r_stamp = p_stamp.add_run("STATUS: UNDER REGULATORY REVIEW // DRAFT SAR PROTOTYPE")
    r_stamp.bold = True
    r_stamp.font.name = 'Arial'
    r_stamp.font.size = Pt(10)
    r_stamp.font.color.rgb = RGBColor(184, 80, 61) # Alert Rust

    doc.add_paragraph("This case dossier compiles multi-agent behavioral sequences and topological ring clusters generated by AEGIS-X intelligence engines.")

    # Metadata Table
    table = doc.add_table(rows=4, cols=2)
    table.style = 'Light Shading Accent 1'
    
    metadata = [
        ("Case/Alert ID:", alert.id),
        ("Scoring Trigger:", alert.triggered_by),
        ("Compliance Score:", f"{(investigation['composite_score'] * 100):.1f}%"),
        ("Model Version:", investigation.get('model_version', 'meta_calibrated_fusion_v4.1.0'))
    ]

    for idx, (label, val) in enumerate(metadata):
        row = table.rows[idx]
        row.cells[0].text = label
        row.cells[1].text = val
        set_cell_background(row.cells[0], "EDE9DF")
        set_cell_background(row.cells[1], "F8F9FA")

    doc.add_paragraph("\n")

    # Executive Summary Narrative
    h1 = doc.add_paragraph()
    h1_run = h1.add_run("1. Executive Summary Narrative")
    h1_run.bold = True
    h1_run.font.size = Pt(12)
    h1_run.font.color.rgb = RGBColor(92, 130, 166)

    narrative = investigation.get('case_report', {}).get('suspicious_activity_narrative', 'No narrative compiled.')
    doc.add_paragraph(narrative)

    # Citations
    h2 = doc.add_paragraph()
    h2_run = h2.add_run("2. Evidence and Regulatory Citations")
    h2_run.bold = True
    h2_run.font.size = Pt(12)
    h2_run.font.color.rgb = RGBColor(92, 130, 166)

    citations = investigation.get('case_report', {}).get('evidence_citations', [])
    for cit in citations:
        doc.add_paragraph(f"• Source: {cit['source']} — Facts: {cit['fact']}", style='List Bullet')
        
    regulations = investigation.get('case_report', {}).get('regulatory_citations', [])
    for reg in regulations:
        doc.add_paragraph(f"• Compliance Authority: {reg}", style='List Bullet')

    # Swarm Transcript
    doc.add_paragraph("\n")
    h3 = doc.add_paragraph()
    h3_run = h3.add_run("3. Autonomous Investigator Swarm Transcript")
    h3_run.bold = True
    h3_run.font.size = Pt(12)
    h3_run.font.color.rgb = RGBColor(92, 130, 166)

    debate_logs = investigation.get('debate_transcript', [])
    for msg in debate_logs:
        dp = doc.add_paragraph()
        run_name = dp.add_run(f"[{msg['agent'].upper()}] - {msg.get('status', 'COMPLETED')}\n")
        run_name.bold = True
        run_name.font.size = Pt(9.5)
        run_name.font.color.rgb = RGBColor(16, 20, 28)
        
        run_msg = dp.add_run(msg['message'])
        run_msg.font.size = Pt(9)
        if "AMLExpert" in msg['agent']:
            run_msg.font.color.rgb = RGBColor(184, 80, 61)

    # Save to buffer
    buffer = io.BytesIO()
    doc.save(buffer)
    buffer.seek(0)
    return buffer.getvalue()


def generate_pptx(
    alert: Any, 
    account: Optional[Any], 
    user: Optional[Any], 
    txn: Optional[Any], 
    investigation: Dict[str, Any], 
    timeline: List[Dict[str, Any]]
) -> bytes:
    """
    Generates a presentation slide deck summarizing the case.
    """
    from pptx.dml.color import RGBColor
    prs = Presentation()
    
    # Color helper
    def set_slide_background(slide, color_hex):
        background = slide.background
        fill = background.fill
        fill.solid()
        r = int(color_hex[1:3], 16)
        g = int(color_hex[3:5], 16)
        b = int(color_hex[5:7], 16)
        fill.fore_color.rgb = RGBColor(r, g, b)

    # Slide 1: Title Slide (Dark Base)
    slide_layout = prs.slide_layouts[5] # Blank layout
    slide1 = prs.slides.add_slide(slide_layout)
    set_slide_background(slide1, HEX_INK_BASE)

    title_box = slide1.shapes.add_textbox(PtInches(0.5), PtInches(2.0), PtInches(9.0), PtInches(2.5))
    tf = title_box.text_frame
    tf.word_wrap = True
    
    p1 = tf.paragraphs[0]
    p1.text = "AEGIS-X FINANCIAL CRIME OPERATING SYSTEM"
    p1.font.bold = True
    p1.font.size = PtSize(14)
    p1.font.color.rgb = RGBColor(201, 155, 77) # Evidence Gold
    p1.alignment = PP_ALIGN.LEFT
    
    p2 = tf.add_paragraph()
    p2.text = f"Case File: {alert.id}"
    p2.font.bold = True
    p2.font.size = PtSize(32)
    p2.font.color.rgb = RGBColor(237, 233, 223) # Paper
    p2.alignment = PP_ALIGN.LEFT

    p3 = tf.add_paragraph()
    p3.text = f"Consensus Risk Calibration: {int(investigation['composite_score'] * 100)}% // Severity: {alert.severity}"
    p3.font.size = PtSize(12)
    p3.font.color.rgb = RGBColor(184, 80, 61) # Alert Rust
    p3.alignment = PP_ALIGN.LEFT

    # Slide 2: Case Overview (Paper/Beige Base for dossier contrast)
    slide2 = prs.slides.add_slide(slide_layout)
    set_slide_background(slide2, HEX_PAPER)

    # Title header
    header_box = slide2.shapes.add_textbox(PtInches(0.5), PtInches(0.3), PtInches(9.0), PtInches(0.8))
    tf_h = header_box.text_frame
    p_h = tf_h.paragraphs[0]
    p_h.text = "EXECUTIVE DOSSIER NARRATIVE"
    p_h.font.bold = True
    p_h.font.size = PtSize(20)
    p_h.font.color.rgb = RGBColor(16, 20, 28)

    # Details Box
    body_box = slide2.shapes.add_textbox(PtInches(0.5), PtInches(1.2), PtInches(9.0), PtInches(4.5))
    tf_b = body_box.text_frame
    tf_b.word_wrap = True
    
    # Text narrative
    p_body = tf_b.paragraphs[0]
    p_body.text = investigation.get('case_report', {}).get('suspicious_activity_narrative', 'No narrative compiled.')
    p_body.font.size = PtSize(14)
    p_body.font.color.rgb = RGBColor(16, 20, 28)
    p_body.space_after = PtSize(14)

    # Add recommendations
    p_rec = tf_b.add_paragraph()
    p_rec.text = f"Swarm Recommendation:\n{investigation.get('recommended_action', 'MONITOR')}"
    p_rec.font.bold = True
    p_rec.font.size = PtSize(14)
    p_rec.font.color.rgb = RGBColor(184, 80, 61)

    # Slide 3: Swarm Debate Consensus (Dark Base)
    slide3 = prs.slides.add_slide(slide_layout)
    set_slide_background(slide3, HEX_INK_BASE)

    header_box3 = slide3.shapes.add_textbox(PtInches(0.5), PtInches(0.3), PtInches(9.0), PtInches(0.8))
    tf_h3 = header_box3.text_frame
    p_h3 = tf_h3.paragraphs[0]
    p_h3.text = "L7 MULTI-AGENT SWARM DEBATE LOGS"
    p_h3.font.bold = True
    p_h3.font.size = PtSize(20)
    p_h3.font.color.rgb = RGBColor(201, 155, 77)

    body_box3 = slide3.shapes.add_textbox(PtInches(0.5), PtInches(1.2), PtInches(9.0), PtInches(5.0))
    tf_b3 = body_box3.text_frame
    tf_b3.word_wrap = True

    debate_logs = investigation.get('debate_transcript', [])
    
    # List top 4 agent arguments
    count = 0
    for msg in debate_logs:
        if msg['agent'] in ["System Orchestrator", "Agent RiskAssessor"]:
            continue
        if count >= 4:
            break
        
        p_agent = tf_b3.add_paragraph() if count > 0 else tf_b3.paragraphs[0]
        p_agent.text = f"• {msg['agent'].upper()}: {msg['message']}"
        p_agent.font.size = PtSize(11)
        p_agent.font.color.rgb = RGBColor(237, 233, 223) if not "AMLExpert" in msg['agent'] else RGBColor(184, 80, 61)
        p_agent.space_after = PtSize(10)
        count += 1

    # Save to buffer
    buffer = io.BytesIO()
    prs.save(buffer)
    buffer.seek(0)
    return buffer.getvalue()
