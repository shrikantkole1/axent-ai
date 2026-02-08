import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Subject, Topic, User } from '../types';

interface ReportData {
    user: User;
    subjects: Subject[];
    topics: Topic[];
    overallScore: number;
    weeklyHours: number;
    progressPercent: number;
    completedTopics: number;
    totalTopics: number;
    activeSubjectsCount: number;
    aiSummary?: string;
}

export const generatePDFReport = (data: ReportData) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Add header background
    doc.setFillColor(37, 99, 235); // Blue-600
    doc.rect(0, 0, pageWidth, 50, 'F');

    // Add logo/title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.text('AXENT AI', 20, 25);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('Academic Progress Report', 20, 35);

    // Add date
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    })}`, pageWidth - 20, 25, { align: 'right' });

    // Reset text color for body
    doc.setTextColor(0, 0, 0);

    let yPos = 60;

    // Student Information Section
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Student Information', 20, yPos);
    yPos += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    autoTable(doc, {
        startY: yPos,
        head: [['Field', 'Value']],
        body: [
            ['Name', data.user.name || 'N/A'],
            ['Email', data.user.email || 'N/A'],
            ['Branch', data.user.branch || 'N/A'],
            ['Study Preference', data.user.energyPreference === 'morning' ? 'Morning' : 'Night'],
            ['Daily Study Hours', `${data.user.dailyStudyHours}h weekday`]
        ],
        theme: 'grid',
        headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 10, cellPadding: 4 },
        columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 60 },
            1: { cellWidth: 'auto' }
        }
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;

    // Summary Statistics Section
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Performance Summary', 20, yPos);
    yPos += 10;

    autoTable(doc, {
        startY: yPos,
        head: [['Metric', 'Value', 'Status']],
        body: [
            ['Overall Readiness', `${data.overallScore}/100`, data.overallScore >= 70 ? '✓ Good' : data.overallScore >= 50 ? '⚠ Fair' : '✗ Needs Improvement'],
            ['Task Completion', `${data.progressPercent}%`, data.progressPercent >= 70 ? '✓ On Track' : '⚠ Behind'],
            ['Topics Completed', `${data.completedTopics}/${data.totalTopics}`, data.totalTopics > 0 ? `${Math.round((data.completedTopics / data.totalTopics) * 100)}%` : 'N/A'],
            ['Active Subjects', `${data.activeSubjectsCount}`, data.activeSubjectsCount > 0 ? '✓ Active' : '⚠ No Subjects'],
            ['Weekly Study Capacity', `${data.weeklyHours} hours`, data.weeklyHours >= 20 ? '✓ Optimal' : '⚠ Low']
        ],
        theme: 'striped',
        headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 10, cellPadding: 4 },
        columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 70 },
            1: { cellWidth: 40, halign: 'center' },
            2: { cellWidth: 'auto', halign: 'center' }
        }
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;

    // AI Insights Section (if available)
    if (data.aiSummary) {
        // Check if we need a new page
        if (yPos > pageHeight - 60) {
            doc.addPage();
            yPos = 20;
        }

        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('AI-Powered Insights', 20, yPos);
        yPos += 10;

        doc.setFillColor(219, 234, 254); // Light blue background
        doc.roundedRect(20, yPos - 5, pageWidth - 40, 35, 3, 3, 'F');

        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(37, 99, 235);
        const splitText = doc.splitTextToSize(data.aiSummary, pageWidth - 50);
        doc.text(splitText, 25, yPos + 5);
        doc.setTextColor(0, 0, 0);

        yPos += 45;
    }

    // Subject Breakdown Section
    if (yPos > pageHeight - 80) {
        doc.addPage();
        yPos = 20;
    }

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Subject Breakdown', 20, yPos);
    yPos += 10;

    const subjectData = data.subjects.map(subject => {
        const subjectTopics = data.topics.filter(t => t.subjectId === subject.id);
        const completedSubjectTopics = subjectTopics.filter(t => t.status === 'Completed').length;
        const progress = subjectTopics.length > 0
            ? `${Math.round((completedSubjectTopics / subjectTopics.length) * 100)}%`
            : '0%';

        return [
            subject.title,
            subject.difficulty || 'N/A',
            `${subject.priority}/5`,
            `${completedSubjectTopics}/${subjectTopics.length}`,
            progress,
            subject.examDate ? new Date(subject.examDate).toLocaleDateString() : 'Not Set'
        ];
    });

    autoTable(doc, {
        startY: yPos,
        head: [['Subject', 'Difficulty', 'Priority', 'Progress', '%', 'Exam Date']],
        body: subjectData.length > 0 ? subjectData : [['No subjects defined yet', '-', '-', '-', '-', '-']],
        theme: 'grid',
        headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold', fontSize: 9 },
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: {
            0: { cellWidth: 60 },
            1: { cellWidth: 25, halign: 'center' },
            2: { cellWidth: 20, halign: 'center' },
            3: { cellWidth: 25, halign: 'center' },
            4: { cellWidth: 20, halign: 'center' },
            5: { cellWidth: 'auto', halign: 'center' }
        }
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;

    // Recommendations Section
    if (yPos > pageHeight - 50) {
        doc.addPage();
        yPos = 20;
    }

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Recommended Actions', 20, yPos);
    yPos += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    const recommendations = [];
    if (data.overallScore < 50) {
        recommendations.push('• Focus on high-weakness topics immediately to improve readiness score');
    } else if (data.overallScore < 70) {
        recommendations.push('• Continue steady progress and start revision cycles');
    } else {
        recommendations.push('• Excellent progress! Maintain current pace and deepen understanding');
    }

    if (data.progressPercent < 50) {
        recommendations.push('• Increase daily study hours to catch up with your schedule');
    }

    if (data.activeSubjectsCount === 0) {
        recommendations.push('• Add subjects to start building your study roadmap');
    }

    if (data.weeklyHours < 20) {
        recommendations.push('• Consider increasing weekly study hours for better outcomes');
    }

    recommendations.forEach(rec => {
        doc.text(rec, 25, yPos);
        yPos += 8;
    });

    // Footer
    const footerY = pageHeight - 20;
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text('Generated by Axent AI - Powered by Tambo Intelligence', pageWidth / 2, footerY, { align: 'center' });
    doc.text(`Page ${doc.getNumberOfPages()}`, pageWidth - 20, footerY, { align: 'right' });

    // Save the PDF
    const fileName = `Axent_Report_${data.user.name?.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
};
