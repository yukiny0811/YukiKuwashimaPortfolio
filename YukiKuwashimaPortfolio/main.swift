//
//  main.swift
//  YukiKuwashimaPortfolio
//
//  Created by Yuki Kuwashima on 2023/07/31.
//

import Foundation
import SwiftyHTMLBuilder

//-----------

let line = hstack {
    div{}
        .height(2, unit: .px)
        .width(70, unit: .percentage)
        .marginTop(10, unit: .px)
        .marginBottom(10, unit: .px)
        .css("background-color", "black")
}.width(100, unit: .percentage).css("justify-content", "flex-start")

let sharp = h1 { "#" }.width(40, unit: .px)
let leftSpacer = div{}.width(40, unit: .px)

func titleContent(_ titleString: String) -> HTML {
    HTML {
        hstack {
            sharp
            h1 { titleString }
        }
        .width(100, unit: .percentage)
        .css("justify-content", "flex-start")
        .marginTop(40, unit: .px)
        line
    }
}

func descContent(_ desc: String) -> HTML {
    HTML {
        hstack {
            leftSpacer
            h2 { desc }
        }
        .width(100, unit: .percentage)
        .css("justify-content", "flex-start")
        .marginTop(10, unit: .px)
    }
}

func projContent(
    projTitle: String,
    projDesc: String,
    madeWithDesc: String,
    links: [String],
    imagePath: String,
    wordColor: String
) -> HTML {
    HTML {
        zstack {
            vstack {
                img(src: imagePath, alt: "")
                    .width(100, unit: .percentage)
            }
            .css("overflow", "hidden")
            .css("border-left", "1px solid gray")
            .width(800, for: .minWidth(1000))
            .width(90, unit: .percentage)
            .height(500, unit: .px)
            .marginLeft(40, unit: .px)
            .marginTop(20, unit: .px)
            vstack {
                hstack {
                    leftSpacer
                    h3 { projTitle }
                }
                .width(100, unit: .percentage)
                .css("justify-content", "flex-start")
                .marginTop(20, unit: .px)
                .color(wordColor)
                .marginLeft(30, unit: .px)
                
                hstack {
                    leftSpacer
                    h4 { projDesc }
                }
                .width(100, unit: .percentage)
                .css("justify-content", "flex-start")
                .marginTop(10, unit: .px)
                .color(wordColor)
                .marginLeft(30, unit: .px)
                
                hstack {
                    leftSpacer
                    h5 { madeWithDesc }
                }
                .width(100, unit: .percentage)
                .css("justify-content", "flex-start")
                .marginTop(10, unit: .px)
                .color(wordColor)
                .marginLeft(30, unit: .px)
                
                for l in links {
                    hstack {
                        leftSpacer
                        a(href: l) { l }
                            .color(wordColor)
                    }
                    .width(100, unit: .percentage)
                    .css("justify-content", "flex-start")
                    .marginTop(10, unit: .px)
                    .color(wordColor)
                    .css("text-decoration", "none")
                    .marginLeft(30, unit: .px)
                }
                
                div{}.marginBottom(20, unit: .px)
            }
            .width(100, unit: .percentage)
            .height(500, unit: .px)
            .css("justify-content", "flex-end")
        }
        .width(100, unit: .percentage)
        .css("justify-content", "flex-start")
        .css("align-items", "flex-start")
        .css("max-width", "820px")
    }
}

//-----------

let HeadBlock = head {
    title("Yuki Kuwashima's Portfolio")
    meta(charset: .utf8)
    meta(name: .description, content: "Yuki Kuwashima's Portfolio")
    meta(name: .viewport, content: "width=device-width,initial-scale=1.0,minimum-scale=1.0")
    "<style>@font-face {font-family: 'SmartFontUI';src: url(Fonts/03スマートフォントUI.otf);}</style>"
}
let BodyBlock = body {
    vstack {
        vstack {
            titleContent("Yuki Kuwashima / 桑島侑己")
            descContent("Keio University B4")
            descContent("Wakita Lab (Computer Simulation and Visualization)")
            descContent("iOS App Developer (Swift)")
            descContent("Graphics Engineer (Swift & Metal)")
            
            // aaa
            titleContent("Fluid Simulation")
            descContent("Simulating fluid dynamics for animation.")
            hstack {
                projContent(
                    projTitle: "Snow Simulation",
                    projDesc: "Implementation of “A Material Point Method for Snow Simulation”",
                    madeWithDesc: "Made with Julia (February 2022)",
                    links: [
                        "https://youtu.be/iCUKV16Fevs",
                        "https://github.com/yukiny0811/mpm-snow"
                    ],
                    imagePath: "Images/mpmsnow.png",
                    wordColor: "black"
                )
                
                projContent(
                    projTitle: "Liquid Animation",
                    projDesc: "Implementation of “Stable Fluids”",
                    madeWithDesc: "Made with Openframeworks (May 2021)",
                    links: [
                        "https://youtu.be/fD4M3d0RW7A",
                        "https://github.com/yukiny0811/stable_fluids_test"
                    ],
                    imagePath: "Images/stablefluids.png",
                    wordColor: "white"
                )
                
                projContent(
                    projTitle: "Ocean Plastic Simulation",
                    projDesc: "Animation of decaying plastics and animals in the ocean.",
                    madeWithDesc: "Made with Python & Taichi (June 2021)",
                    links: [],
                    imagePath: "Images/noimage.png",
                    wordColor: "white"
                )
            }
            .width(100, unit: .percentage)
            .css("justify-content", "flex-start")
            .css("flex-wrap", "wrap")
            
            // aaa
            titleContent("Generative Art")
            descContent("Computer artworks generated from random parameters.")
            hstack {
                projContent(
                    projTitle: "Lonely Plants",
                    projDesc: "Observe the lonely lives.\nL-System Algorithm used for plant generation.\nStable Fluids algorithm used for plant decaying.",
                    madeWithDesc: "Made with Julia (February 2022)",
                    links: [
                        "https://youtu.be/iCUKV16Fevs",
                        "https://github.com/yukiny0811/mpm-snow"
                    ],
                    imagePath: "Images/mpmsnow.png",
                    wordColor: "black"
                )
                
                projContent(
                    projTitle: "Liquid Animation",
                    projDesc: "Implementation of “Stable Fluids”",
                    madeWithDesc: "Made with Openframeworks (May 2021)",
                    links: [
                        "https://youtu.be/fD4M3d0RW7A",
                        "https://github.com/yukiny0811/stable_fluids_test"
                    ],
                    imagePath: "Images/stablefluids.png",
                    wordColor: "white"
                )
                
                projContent(
                    projTitle: "Ocean Plastic Simulation",
                    projDesc: "Animation of decaying plastics and animals in the ocean.",
                    madeWithDesc: "Made with Python & Taichi (June 2021)",
                    links: [],
                    imagePath: "Images/noimage.png",
                    wordColor: "white"
                )
            }
            .width(100, unit: .percentage)
            .css("justify-content", "flex-start")
            .css("flex-wrap", "wrap")
            
        }
        .width(95, unit: .percentage)
    }
    .width(100, unit: .vw)
    .marginTop(50, unit: .px)
}
let mainHTML = HTML {
    all {
        doctype()
        html {
            HeadBlock
            BodyBlock
        }
    }
    .padding("0")
    .margin("0")
    .css("font-family", "SmartFontUI")
}

enum YukiKuwashimaPortfolio {
    static func exportHTML() {
        guard let projectRootPath = ProcessInfo.processInfo.environment["MY_ROOT"] else { return }
        let projectRootURL = URL(filePath: projectRootPath)
        let fileURL = projectRootURL.appendingPathComponent("index.html", isDirectory: false)
        let compiled = HTMLCompiler.compile(with: mainHTML)
        try! compiled.write(toFile: fileURL.relativePath, atomically: true, encoding: .utf8)
    }
}

YukiKuwashimaPortfolio.exportHTML()
