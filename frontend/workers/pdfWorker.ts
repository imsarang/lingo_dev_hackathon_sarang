import jsPDF from "jspdf"

self.onmessage = async (event: MessageEvent) => {
    const { messages } = event.data
    try{
        const doc = new jsPDF()
        
        let yPosition = 20
        const pageHeight = doc.internal.pageSize.height
        const lineHeight = 7
        const margin = 20
        
        messages.forEach((msg: any, index: number) => {
            // Add new page if needed
            if (yPosition > pageHeight - 30) {
                doc.addPage()
                yPosition = 20
            }
            
            // Add message type and content
            const sender = msg.type === 'user' ? 'You' : 'AI Assistant'
            const timestamp = new Date(msg.timestamp).toLocaleString()
            
            doc.setFontSize(10)
            doc.setTextColor(100, 100, 100)
            doc.text(`${sender} - ${timestamp}`, margin, yPosition)
            yPosition += lineHeight
            
            doc.setFontSize(12)
            doc.setTextColor(0, 0, 0)
            const textLines = doc.splitTextToSize(msg.content || '', doc.internal.pageSize.width - 2 * margin)
            textLines.forEach((line: string) => {
                if (yPosition > pageHeight - 30) {
                    doc.addPage()
                    yPosition = 20
                }
                doc.text(line, margin, yPosition)
                yPosition += lineHeight
            })
            
            yPosition += 5 // Space between messages
        })

        const pdfBlob = doc.output("blob")
        self.postMessage({success: true, pdfBlob, message: "PDF Created"})
    }
    catch(err: any){
        self.postMessage({success: false, error: err?.message || "Error while generating PDF"})
    }
}