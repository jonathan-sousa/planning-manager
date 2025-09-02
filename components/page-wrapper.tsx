interface PageWrapperProps {
  children: React.ReactNode
  maxWidth?: "sm" | "md" | "lg" | "xl" | "full"
}

export function PageWrapper({ children, maxWidth = "xl" }: PageWrapperProps) {
  const widthClasses = {
    sm: "max-w-2xl",
    md: "max-w-4xl", 
    lg: "max-w-6xl",
    xl: "max-w-7xl",
    full: "w-full"
  }

  return (
    <div className={`${widthClasses[maxWidth]} mx-auto`}>
      {children}
    </div>
  )
}